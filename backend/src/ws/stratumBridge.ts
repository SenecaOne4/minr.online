import WebSocket from 'ws';
import net from 'net';
import { supabase } from '../supabaseClient';

const STRATUM_UPSTREAM = process.env.STRATUM_UPSTREAM ?? 'solo.ckpool.org:3333';
const BTC_MINING_PASSWORD = process.env.BTC_MINING_PASSWORD ?? 'x';

interface ConnectionMeta {
  userId?: string;
  sessionId?: string;
  miningSessionId?: string;
  currentJob?: any;
  shareCount: number;
  acceptedShares: number;
  rejectedShares: number;
  totalHashes: number;
  startTime?: number;
}

export function handleStratumConnection(ws: WebSocket): void {
  console.log('[bridge] WebSocket client connected');

  // Connection metadata for tracking
  const meta: ConnectionMeta = {
    shareCount: 0,
    acceptedShares: 0,
    rejectedShares: 0,
    totalHashes: 0,
  };
  let metaReceived = false;
  let paymentChecked = false;
  let adminWallet = '';

  // Parse upstream address
  const [host, portStr] = STRATUM_UPSTREAM.split(':');
  const port = parseInt(portStr, 10);

  if (!host || !port) {
    console.error(`[bridge] Invalid STRATUM_UPSTREAM format: ${STRATUM_UPSTREAM}`);
    ws.close(1008, 'Invalid upstream configuration');
    return;
  }

  // Get admin wallet from site settings
  (async () => {
    if (supabase) {
      try {
        const { data: settings } = await supabase
          .from('site_settings')
          .select('admin_btc_wallet')
          .eq('id', '00000000-0000-0000-0000-000000000000')
          .single();
        
        if (settings?.admin_btc_wallet) {
          adminWallet = settings.admin_btc_wallet;
        }
      } catch (error) {
        console.warn('[bridge] Could not fetch admin wallet, using default');
        adminWallet = process.env.BTC_MINING_USERNAME ?? 'bc1qchm0vkcdkzrstlh05w5zd7j5788yysyfmnlf47';
      }
    }
  })();

  // Create TCP connection to Stratum pool
  const tcpSocket = net.createConnection(port, host);

  tcpSocket.on('connect', () => {
    console.log(`[bridge] TCP connection established to ${STRATUM_UPSTREAM}`);
  });

  tcpSocket.on('data', async (data: Buffer) => {
    // Forward TCP → WebSocket (as UTF-8 text)
    const chunk = data.toString('utf8');
    console.log('[bridge] ← upstream', chunk.slice(0, 200));
    
    // Parse and log all responses
    try {
      // Handle multiple JSON messages in one chunk (Stratum can send multiple lines)
      const lines = chunk.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          
          // Log authorization response
          if (parsed.id === 2) {
            if (parsed.result === true) {
              console.log('[bridge] ✅ Authorization SUCCESS (ID: 2)');
            } else {
              console.log('[bridge] ❌ Authorization FAILED (ID: 2):', parsed.error || 'Unknown error');
            }
          }
          
          // Log submit responses and update share status
          if (parsed.id && parsed.id >= 3 && parsed.id < 100) {
            if (parsed.result === true) {
              console.log('[bridge] ✅ Submit SUCCESS (ID:', parsed.id, ')');
              
              // Update share status to accepted
              if (meta.userId && supabase) {
                try {
                  const { error: updateError } = await supabase
                    .from('share_submissions')
                    .update({ status: 'accepted' })
                    .eq('user_id', meta.userId)
                    .eq('status', 'pending')
                    .order('submitted_at', { ascending: false })
                    .limit(1);
                  
                  if (updateError) {
                    console.error('[bridge] Error updating share to accepted:', updateError);
                  } else {
                    meta.acceptedShares++;
                    console.log('[bridge] ✅ Share accepted, total:', meta.acceptedShares);
                  }
                  
                  // Update session stats
                  if (meta.miningSessionId) {
                    const duration = meta.startTime ? (Date.now() - meta.startTime) / 1000 : 0;
                    const avgHashrate = duration > 0 ? meta.totalHashes / duration : 0;
                    
                    const { error: sessionError } = await supabase
                      .from('mining_sessions')
                      .update({
                        accepted_shares: meta.acceptedShares,
                        rejected_shares: meta.rejectedShares,
                        total_hashes: meta.totalHashes,
                        avg_hashrate: avgHashrate,
                      })
                      .eq('id', meta.miningSessionId);
                    
                    if (sessionError) {
                      console.error('[bridge] Error updating session stats:', sessionError);
                    }
                  }
                } catch (error: any) {
                  console.error('[bridge] Exception updating share status:', error.message);
                }
              }
            } else {
              console.log('[bridge] ❌ Submit FAILED (ID:', parsed.id, '):', parsed.error || 'Unknown error');
              
              // Update share status to rejected
              if (meta.userId && supabase) {
                try {
                  const { error: updateError } = await supabase
                    .from('share_submissions')
                    .update({ status: 'rejected' })
                    .eq('user_id', meta.userId)
                    .eq('status', 'pending')
                    .order('submitted_at', { ascending: false })
                    .limit(1);
                  
                  if (updateError) {
                    console.error('[bridge] Error updating share to rejected:', updateError);
                  } else {
                    meta.rejectedShares++;
                    console.log('[bridge] ❌ Share rejected, total:', meta.rejectedShares);
                  }
                  
                  // Update session stats
                  if (meta.miningSessionId) {
                    const duration = meta.startTime ? (Date.now() - meta.startTime) / 1000 : 0;
                    const avgHashrate = duration > 0 ? meta.totalHashes / duration : 0;
                    
                    const { error: sessionError } = await supabase
                      .from('mining_sessions')
                      .update({
                        accepted_shares: meta.acceptedShares,
                        rejected_shares: meta.rejectedShares,
                        total_hashes: meta.totalHashes,
                        avg_hashrate: avgHashrate,
                      })
                      .eq('id', meta.miningSessionId);
                    
                    if (sessionError) {
                      console.error('[bridge] Error updating session stats:', sessionError);
                    }
                  }
                } catch (error: any) {
                  console.error('[bridge] Exception updating share status:', error.message);
                }
              }
            }
          }
          
          // Handle mining.notify to track current job
          if (parsed.method === 'mining.notify' && parsed.params) {
            meta.currentJob = {
              jobId: parsed.params[0],
              difficulty: meta.currentJob?.difficulty,
            };
          }
          
          // Handle mining.set_difficulty
          if (parsed.method === 'mining.set_difficulty' && parsed.params && parsed.params[0]) {
            if (meta.currentJob) {
              meta.currentJob.difficulty = parsed.params[0];
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    } catch (e) {
      // Not JSON or parse failed - continue
    }
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk);
    } else {
      console.warn('[bridge] WebSocket not open, dropping upstream data');
    }
  });

  tcpSocket.on('error', (error: Error) => {
    console.error(`[bridge] TCP socket error to ${STRATUM_UPSTREAM}:`, error.message);
    console.error(`[bridge] TCP error code:`, (error as any).code);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1011, `Upstream connection error: ${error.message}`);
    }
  });

  tcpSocket.on('close', (hadError: boolean) => {
    console.log(`[bridge] TCP connection to ${STRATUM_UPSTREAM} closed (hadError: ${hadError})`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1001, hadError ? 'Upstream connection error' : 'Upstream connection closed');
    }
  });

  // Forward WebSocket → TCP with mining.authorize interception and meta handling
  ws.on('message', (message: Buffer) => {
    if (!tcpSocket.writable) {
      console.warn('[bridge] TCP socket not writable, dropping message');
      return;
    }

    const messageStr = message.toString('utf8');
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(messageStr);
      
      // Handle meta message (only if not already received and this looks like meta)
      if (!metaReceived && parsed && typeof parsed === 'object' && parsed.type === 'meta') {
        meta.userId = parsed.userId;
        meta.sessionId = parsed.sessionId;
        metaReceived = true;
        console.log('[bridge] meta from client', meta);
        
        // Check payment status before allowing mining (async IIFE)
        (async () => {
          if (meta.userId && supabase) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('has_paid_entry_fee, exempt_from_entry_fee, is_admin')
                .eq('id', meta.userId)
                .single();
              
              // Get user email from auth if available
              let userEmail = '';
              if (meta.userId) {
                const { data: { user } } = await supabase.auth.admin.getUserById(meta.userId);
                userEmail = user?.email || '';
              }
              
              // Admins are automatically exempt
              const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'senecaone4@gmail.com';
              const isAdmin = userEmail === ADMIN_EMAIL || profile?.is_admin === true;
              
              if (!profile?.has_paid_entry_fee && !profile?.exempt_from_entry_fee && !isAdmin) {
                console.log('[bridge] User has not paid entry fee, closing connection');
                ws.send(JSON.stringify({
                  error: 'Entry fee payment required. Please pay $1 USD to start mining.',
                  code: 'PAYMENT_REQUIRED',
                }));
                ws.close(1008, 'Payment required');
                return;
              }
              
              paymentChecked = true;
              
              // Create mining session
              const { data: session, error: sessionError } = await supabase
                .from('mining_sessions')
                .insert({
                  user_id: meta.userId,
                  worker_name: parsed.workerName || `worker-${meta.sessionId}`,
                  started_at: new Date().toISOString(),
                })
                .select()
                .single();
              
              if (sessionError) {
                console.error('[bridge] Error creating mining session:', sessionError);
              } else if (session) {
                meta.miningSessionId = session.id;
                meta.startTime = Date.now();
                console.log('[bridge] ✅ Mining session created:', session.id, 'for user:', meta.userId);
              } else {
                console.error('[bridge] Failed to create mining session: no data returned');
              }
            } catch (error: any) {
              console.error('[bridge] Error checking payment:', error.message);
            }
          }
        })();
        
        // Do NOT forward meta messages to TCP socket
        return;
      }
      
      // Check if this is a mining.subscribe message
      if (parsed && typeof parsed === 'object' && parsed.method === 'mining.subscribe') {
        console.log('[bridge] subscribe from client, forwarding to upstream');
        
        // Forward the original subscribe message to TCP (add newline for Stratum protocol)
        const outboundStr = messageStr.trim() + '\n';
        console.log('[bridge] → upstream', outboundStr.slice(0, 200));
        tcpSocket.write(outboundStr);
        
        // NOTE: Frontend will send authorize after receiving subscribe response
        // We don't send authorize here to avoid duplicate authorize messages
        // The bridge used to auto-authorize, but now frontend handles it
        
        return;
      }
      
      // Check if this is a mining.authorize message from frontend
      if (parsed && typeof parsed === 'object' && parsed.method === 'mining.authorize') {
        console.log('[bridge] authorize from client, forwarding to upstream');
        // Forward as-is with newline (Stratum protocol requires newline)
        tcpSocket.write(messageStr.trim() + '\n');
        return;
      }

      // Check if this is a mining.submit message
      if (parsed && typeof parsed === 'object' && parsed.method === 'mining.submit') {
        const submitParams = parsed.params || [];
        const jobId = submitParams[1];
        const nonce = submitParams[4];
        
        console.log('[bridge] ← client submit (ID:', parsed.id, '):', {
          worker: submitParams[0],
          jobId,
          extranonce2: submitParams[2],
          ntime: submitParams[3],
          nonce,
        });
        
        // Record share submission (async IIFE)
        if (meta.userId && meta.miningSessionId && supabase) {
          (async () => {
            try {
              console.log('[bridge] Inserting share:', { 
                userId: meta.userId, 
                sessionId: meta.miningSessionId, 
                jobId, 
                nonce 
              });
              
              const { data, error } = await supabase
                .from('share_submissions')
                .insert({
                  user_id: meta.userId,
                  session_id: meta.miningSessionId,
                  job_id: jobId,
                  nonce: nonce,
                  status: 'pending',
                  difficulty: meta.currentJob?.difficulty || 1,
                  submitted_at: new Date().toISOString(), // Explicitly set timestamp for analytics queries
                })
                .select()
                .single();
              
              if (error) {
                console.error('[bridge] Error inserting share:', error);
              } else {
                console.log('[bridge] ✅ Share inserted successfully:', data?.id);
                meta.shareCount++;
              }
            } catch (error: any) {
              console.error('[bridge] Exception recording share:', error.message, error.stack);
            }
          })();
        } else {
          console.warn('[bridge] Cannot record share - missing userId or sessionId:', {
            userId: meta.userId,
            sessionId: meta.miningSessionId
          });
        }
        
        // Forward to TCP upstream (add newline for Stratum protocol)
        tcpSocket.write(messageStr.trim() + '\n');
        return;
      }
    } catch (parseError) {
      // Not JSON or parse failed - forward as-is
      // Log a concise warning without stack spam
      if (messageStr.length > 0) {
        console.warn('[bridge] non-JSON message, forwarding as-is');
      }
    }
    
    // Forward all other messages unchanged (add newline for Stratum protocol)
    const outboundStr = messageStr.trim() + '\n';
    console.log('[bridge] → upstream', outboundStr.slice(0, 200));
    tcpSocket.write(outboundStr);
  });

  ws.on('close', async () => {
    console.log('[bridge] WebSocket client disconnected');
    
    // End mining session
    if (meta.miningSessionId && supabase) {
      try {
        const endTime = Date.now();
        const duration = meta.startTime ? (endTime - meta.startTime) / 1000 : 0;
        const avgHashrate = duration > 0 ? meta.totalHashes / duration : 0;
        
        await supabase
          .from('mining_sessions')
          .update({
            ended_at: new Date().toISOString(),
            total_hashes: meta.totalHashes,
            accepted_shares: meta.acceptedShares,
            rejected_shares: meta.rejectedShares,
            avg_hashrate: avgHashrate,
          })
          .eq('id', meta.miningSessionId);
        
        console.log('[bridge] Mining session ended:', meta.miningSessionId);
      } catch (error: any) {
        console.error('[bridge] Error ending session:', error.message);
      }
    }
    
    if (!tcpSocket.destroyed) {
      tcpSocket.end();
    }
  });

  ws.on('error', (error: Error) => {
    console.error('[bridge] WebSocket error:', error.message);
    if (!tcpSocket.destroyed) {
      tcpSocket.end();
    }
  });
}

