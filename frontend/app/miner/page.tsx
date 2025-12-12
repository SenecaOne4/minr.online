'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

interface CurrentJob {
  jobId: string;
  prevhash: string;
  coinb1: string;
  coinb2: string;
  merkleBranches: string[];
  version: string;
  nBits: string;
  nTime: string;
  cleanJobs: boolean;
  difficulty?: number;
  target?: string; // Computed target for share validation
}

interface ExtraNonce {
  extranonce1: string;
  extranonce2Size: number;
}

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'info' | 'client' | 'pool' | 'error' | 'demo';
  message: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type WorkerState = 'starting' | 'running' | 'stopped' | 'error';

const PAYOUT_ADDRESS = 'bc1qchm0vkcdkzrstlh05w5zd7j5788yysyfmnlf47';
const BTC_MINING_USERNAME = 'bc1qchm0vkcdkzrstlh05w5zd7j5788yysyfmnlf47';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.minr.online/ws/stratum-browser';

export default function MinerPage() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isMining, setIsMining] = useState(false);
  const [desiredDifficulty, setDesiredDifficulty] = useState(16);
  const [nonceStride, setNonceStride] = useState(1);
  const [hashesPerSecond, setHashesPerSecond] = useState(0);
  const [totalHashes, setTotalHashes] = useState(0);
  const [realShares, setRealShares] = useState(0);
  const [lastSubmitResult, setLastSubmitResult] = useState<string | null>(null);
  const [lastSubmitTime, setLastSubmitTime] = useState<number | null>(null);
  const [miningStartTime, setMiningStartTime] = useState<number | null>(null);
  const [currentJob, setCurrentJob] = useState<CurrentJob | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [extraNonce, setExtraNonce] = useState<ExtraNonce | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const submitIdRef = useRef(3);
  const sessionIdRef = useRef(`browser-${Date.now()}`);
  const nonceSeedRef = useRef(Math.floor(Math.random() * 0xffffffff));

  const wsRef = useRef<WebSocket | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [workerState, setWorkerState] = useState<WorkerState>('starting');
  const [workerError, setWorkerError] = useState<string | null>(null);
  const logIdRef = useRef(0);

  // Helper to add log entries
  const addLog = (type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  };

  // Initialize Web Worker immediately on page load
  useEffect(() => {
    setWorkerState('starting');
    setWorkerError(null);
    
    try {
      // Create worker with cache-busting query param
      const workerUrl = `/miner.worker.js?v=${Date.now()}`;
      const worker = new Worker(workerUrl);
      workerRef.current = worker;
      addLog('info', 'Worker created');
      setWorkerState('stopped');

      // Handle worker messages
      worker.onmessage = (e) => {
        const { type, hashesCompleted, hashesPerSecond, share } = e.data;

        if (type === 'progress') {
          setHashesPerSecond(hashesPerSecond);
          setTotalHashes((prev) => prev + hashesCompleted);
        } else if (type === 'shareFound') {
          // Real share found - submit to pool
          addLog('info', `Worker found share: job=${share.jobId}, nonce=${share.nonce}`);
          if (share && wsRef.current?.readyState === WebSocket.OPEN) {
            submitRealShare(share);
          }
        } else if (type === 'stopped') {
          setWorkerState('stopped');
          setIsMining(false);
          setTotalHashes((prev) => prev + hashesCompleted);
          addLog('info', 'Mining stopped');
        }
      };

      worker.onerror = (error) => {
        const errorMsg = error.message || 'Unknown worker error';
        console.error('Worker error:', error);
        setWorkerError(errorMsg);
        setWorkerState('error');
        addLog('error', `Worker error: ${errorMsg}`);
      };

      // Cleanup on unmount
      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to create worker';
      setWorkerError(errorMsg);
      setWorkerState('error');
      addLog('error', `Failed to create worker: ${errorMsg}`);
    }
  }, []);

  // Auto-send job to worker when WS connects and job is received
  // Use a ref to track last job ID to prevent duplicate sends
  const lastJobIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (workerRef.current && currentJob && extraNonce && connectionStatus === 'connected') {
      // Prevent duplicate sends for the same job
      if (lastJobIdRef.current === currentJob.jobId) {
        return;
      }
      lastJobIdRef.current = currentJob.jobId;
      
      // Merge current difficulty into job if not already set
      const jobWithDifficulty = {
        ...currentJob,
        difficulty: currentJob.difficulty || difficulty || undefined,
        target: currentJob.target || (difficulty ? computeTarget(difficulty) : undefined),
      };
      
      const jobData = {
        ...jobWithDifficulty,
        extraNonce,
        nonceStart: nonceSeedRef.current,
        nonceStride: nonceStride,
      };
      
      workerRef.current.postMessage({
        type: 'job',
        data: jobData,
      });
      
      const jobDifficulty = jobWithDifficulty.difficulty || difficulty || 'unknown';
      addLog('info', `Worker received job: ${currentJob.jobId} (difficulty: ${jobDifficulty})`);
    }
  }, [currentJob?.jobId, extraNonce, nonceStride, connectionStatus, difficulty]);

  // Check for high difficulty warning (no submits after 60 seconds)
  useEffect(() => {
    if (!isMining || !miningStartTime || realShares > 0) return;

    const checkInterval = setInterval(() => {
      const elapsed = (Date.now() - miningStartTime) / 1000;
      if (elapsed >= 60 && difficulty && difficulty >= 1000) {
        addLog('error', '⚠️ No shares found after 60s. Pool difficulty may be too high for browsers.');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [isMining, miningStartTime, realShares, difficulty]);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addLog('info', 'Already connected');
      return;
    }

    setConnectionStatus('connecting');
    addLog('info', `Connecting to ${WS_URL}...`);

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        addLog('info', 'WebSocket connected');

        // Send mining.subscribe
        const subscribeMsg = {
          id: 1,
          method: 'mining.subscribe',
          params: [],
        };
        ws.send(JSON.stringify(subscribeMsg));
        addLog('client', `→ ${JSON.stringify(subscribeMsg)}`);
      };

      ws.onmessage = (event) => {
        const data = event.data;
        addLog('pool', `← ${data}`);

        // Handle multiple JSON messages in one chunk (Stratum can send multiple lines)
        const lines = data.trim().split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          // Try to parse as JSON
          try {
            const parsed = JSON.parse(line);

          // Handle mining.subscribe response
          if (parsed.id === 1 && parsed.result) {
            const result = parsed.result;
            if (Array.isArray(result) && result.length >= 2) {
              const extranonce1 = result[1] || '';
              const extranonce2Size = result[2] || 4;
              setExtraNonce({ extranonce1, extranonce2Size });
              addLog('info', `ExtraNonce: ${extranonce1}, size: ${extranonce2Size}`);
              
              // Send mining.authorize after subscribe response
              const authorizeMsg = {
                id: 2,
                method: 'mining.authorize',
                params: [
                  process.env.NEXT_PUBLIC_BTC_MINING_USERNAME || BTC_MINING_USERNAME,
                  process.env.NEXT_PUBLIC_BTC_MINING_PASSWORD || 'x',
                ],
              };
              ws.send(JSON.stringify(authorizeMsg));
              addLog('client', `→ ${JSON.stringify(authorizeMsg)}`);
              
              // Send mining.suggest_difficulty (some pools support it)
              const suggestDiffMsg = {
                id: 100,
                method: 'mining.suggest_difficulty',
                params: [desiredDifficulty],
              };
              ws.send(JSON.stringify(suggestDiffMsg));
              addLog('client', `→ Suggest difficulty: ${desiredDifficulty}`);
            }
          }

          // Handle mining.authorize response
          if (parsed.id === 2) {
            if (parsed.result === true) {
              addLog('info', `✅ Authorization successful`);
            } else {
              const errorMsg = parsed.error || 'Unknown error';
              addLog('error', `❌ Authorization failed: ${errorMsg}`);
            }
          }

          // Handle mining.suggest_difficulty response
          if (parsed.id === 100) {
            if (parsed.result === true) {
              addLog('info', `✅ Pool accepted suggested difficulty: ${desiredDifficulty}`);
            } else {
              addLog('info', `ℹ️ Pool does not support suggest_difficulty or rejected. Using assigned difficulty.`);
            }
          }

          // Handle mining.notify (full params)
          if (parsed.method === 'mining.notify') {
            const params = parsed.params || [];
            addLog('info', `Received mining.notify with ${params.length} params`);
            if (params.length >= 9) {
              // Use current difficulty state (may have been set by mining.set_difficulty)
              // Use a ref or closure to get the latest difficulty value
              setDifficulty((prevDiff) => {
                const currentDifficulty = prevDiff || difficulty;
                const job: CurrentJob = {
                  jobId: params[0] || '',
                  prevhash: params[1] || '',
                  coinb1: params[2] || '',
                  coinb2: params[3] || '',
                  merkleBranches: Array.isArray(params[4]) ? params[4] : [],
                  version: params[5] || '',
                  nBits: params[6] || '',
                  nTime: params[7] || '',
                  cleanJobs: params[8] === true,
                  difficulty: currentDifficulty || undefined,
                  target: currentDifficulty ? computeTarget(currentDifficulty) : undefined,
                };
                setCurrentJob(job);
                addLog('info', `✅ New job received: ${job.jobId} (prevhash: ${job.prevhash.substring(0, 16)}..., difficulty: ${currentDifficulty || 'unknown'})`);
                if (job.cleanJobs) {
                  addLog('info', 'Clean jobs flag set - reset worker');
                }
                return prevDiff; // Don't change difficulty state
              });
            } else {
              addLog('error', `⚠️ mining.notify has insufficient params (got ${params.length}, need 9)`);
            }
          }

          // Handle mining.set_difficulty
          if (parsed.method === 'mining.set_difficulty') {
            const newDifficulty = parsed.params?.[0];
            if (typeof newDifficulty === 'number') {
              setDifficulty(newDifficulty);
              const target = computeTarget(newDifficulty);
              setCurrentJob((prev) =>
                prev
                  ? { ...prev, difficulty: newDifficulty, target }
                  : null
              );
              addLog('info', `Difficulty set to: ${newDifficulty} (target: ${target.substring(0, 16)}...)`);
              if (newDifficulty >= 1000) {
                addLog('error', `⚠️ High difficulty (${newDifficulty}) - browsers may not find shares`);
              } else if (newDifficulty <= 100) {
                addLog('info', `✅ Low difficulty (${newDifficulty}) - good for browser mining!`);
              }
            }
          }

          // Handle mining.submit response
          if (parsed.id && parsed.id >= 3 && parsed.id < 100) {
            if (parsed.result === true) {
              addLog('pool', `✅ Pool responded: Share accepted! (ID: ${parsed.id})`);
              setRealShares((prev) => prev + 1);
              setLastSubmitResult('✅ Accepted');
              setLastSubmitTime(Date.now());
            } else {
              const errorMsg = parsed.error || 'Unknown error';
              addLog('error', `❌ Pool responded: Share rejected: ${errorMsg} (ID: ${parsed.id})`);
              setLastSubmitResult(`❌ Rejected: ${errorMsg}`);
            }
          }

          // Handle other responses
          if ((parsed.result || parsed.error) && !parsed.id) {
            addLog('pool', `Response: ${JSON.stringify(parsed)}`);
          }
          } catch (parseError) {
            // Not JSON or parse failed - skip this line, already logged as raw text
            // Only log if it looks like it might be JSON (starts with { or [)
            if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
              console.warn('Failed to parse JSON line:', line);
              addLog('error', `Failed to parse JSON: ${line.substring(0, 100)}`);
            }
          }
        }
      };

      ws.onerror = (error) => {
        setConnectionStatus('error');
        addLog('error', 'WebSocket error occurred');
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        const reason = event.reason || 'No reason provided';
        const code = event.code;
        addLog('info', `WebSocket disconnected (code: ${code}, reason: ${reason || 'none'})`);
        if (code !== 1000 && code !== 1001) {
          addLog('error', `Unexpected disconnect - code ${code} usually indicates an error`);
        }
        wsRef.current = null;
      };
    } catch (error) {
      setConnectionStatus('error');
      addLog('error', `Failed to connect: ${error}`);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    addLog('info', 'Disconnected from pool');
  };

  // Compute target from difficulty (Bitcoin stratum share target standard)
  const computeTarget = (diff: number): string => {
    // target = floor(2^224 / difficulty) for difficulty > 0
    // 2^224 = 0x00000000ffff0000000000000000000000000000000000000000000000000000
    if (diff <= 0) {
      return '00000000ffff0000000000000000000000000000000000000000000000000000';
    }
    const maxTarget = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');
    const target = maxTarget / BigInt(Math.floor(diff));
    return target.toString(16).padStart(64, '0');
  };

  // Start mining function - always uses real share mode
  const startMining = () => {
    if (!workerRef.current || workerState !== 'stopped') {
      return;
    }

    // Check if we have everything needed for real mining
    if (!currentJob || !extraNonce || connectionStatus !== 'connected') {
      const reasons = [];
      if (connectionStatus !== 'connected') reasons.push('not connected to pool');
      if (!extraNonce) reasons.push('not subscribed');
      if (!currentJob) reasons.push('no job received');
      addLog('error', `Cannot start mining: ${reasons.join(', ')}. Connect to pool and wait for a job.`);
      return;
    }

    setWorkerState('starting');
    setWorkerError(null);
    setTotalHashes(0);
    
    // Send job data
    workerRef.current.postMessage({
      type: 'job',
      data: {
        ...currentJob,
        extraNonce,
        nonceStart: nonceSeedRef.current,
        nonceStride: nonceStride,
      },
    });
    
    workerRef.current.postMessage({ 
      type: 'start', 
      nonceStart: nonceSeedRef.current,
      nonceStride: nonceStride,
    });
    
    setWorkerState('running');
    setIsMining(true);
    setMiningStartTime(Date.now());
    setRealShares(0);
    setLastSubmitResult(null);
    addLog('info', `✅ Mining started (difficulty: ${difficulty || 'unknown'}, stride: ${nonceStride})`);
  };

  const stopMining = () => {
    if (workerRef.current && (workerState === 'running' || workerState === 'starting')) {
      workerRef.current.postMessage({ type: 'stop' });
      setWorkerState('stopped');
      setIsMining(false);
      addLog('info', 'Mining stopped');
    }
  };

  // Submit real share to pool
  function submitRealShare(share: {
    jobId: string;
    extranonce2: string;
    ntime: string;
    nonce: string;
  }) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('error', 'Cannot submit share - not connected to pool');
      return;
    }

    if (!extraNonce) {
      addLog('error', 'Cannot submit share - extranonce not set');
      return;
    }

    const submitId = submitIdRef.current++;
    const workerName = process.env.NEXT_PUBLIC_WORKER_NAME || `minr.online.${sessionIdRef.current}`;
    const msg = {
      id: submitId,
      method: 'mining.submit',
      params: [
        workerName,
        share.jobId,
        share.extranonce2,
        share.ntime,
        share.nonce,
      ],
    };

    wsRef.current.send(JSON.stringify(msg));
    addLog('client', `→ UI sending mining.submit (ID: ${submitId}): job=${share.jobId}, nonce=${share.nonce}`);
  }

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'client':
        return 'text-blue-400';
      case 'pool':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'demo':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUserEmail(session?.user?.email);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <Navbar userEmail={userEmail} />
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-white">Minr.online</h1>
          <p className="text-gray-300 text-lg">Bitcoin Mining Platform</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl p-6 shadow-2xl">
              <h2 className="text-2xl font-semibold mb-4 text-white">Mining Dashboard</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Payout Address</label>
                  <p className="font-mono text-sm break-all">{PAYOUT_ADDRESS}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Hashrate</label>
                    <p className="text-2xl font-bold">
                      {hashesPerSecond >= 1000000 
                        ? `${(hashesPerSecond / 1000000).toFixed(2)} MH/s`
                        : hashesPerSecond >= 1000
                        ? `${(hashesPerSecond / 1000).toFixed(2)} kH/s`
                        : `${hashesPerSecond.toLocaleString()} H/s`}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Total Hashes</label>
                    <p className="text-2xl font-bold">
                      {totalHashes >= 1000000000
                        ? `${(totalHashes / 1000000000).toFixed(2)}B`
                        : totalHashes >= 1000000
                        ? `${(totalHashes / 1000000).toFixed(2)}M`
                        : totalHashes >= 1000
                        ? `${(totalHashes / 1000).toFixed(2)}K`
                        : totalHashes.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Worker State</label>
                  <p className={`font-semibold ${
                    workerState === 'running' ? 'text-green-600' :
                    workerState === 'starting' ? 'text-yellow-600' :
                    workerState === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {workerState.toUpperCase()}
                  </p>
                  {workerError && (
                    <p className="text-xs text-red-400 mt-1">Error: {workerError}</p>
                  )}
                </div>

                {difficulty && difficulty >= 1000 && (
                  <div className="bg-red-900/30 border border-red-600 rounded p-3">
                    <p className="text-red-400 font-semibold">
                      ⚠️ High Difficulty Warning
                    </p>
                    <p className="text-xs text-red-300 mt-1">
                      Current difficulty: {difficulty}. Browsers may not find shares at this difficulty.
                      {miningStartTime && realShares === 0 && (Date.now() - miningStartTime) / 1000 >= 60 && (
                        <span className="block mt-1 font-semibold">
                          No shares after 60s. Use a pool with lower difficulty or run our own stratum coordinator.
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {realShares > 0 && (
                  <div className="bg-green-900/30 border border-green-600 rounded p-3">
                    <p className="text-green-400">
                      ✅ Shares Submitted: <span className="font-bold">{realShares}</span>
                    </p>
                    {lastSubmitResult && (
                      <p className="text-xs text-green-300 mt-1">
                        Last result: {lastSubmitResult}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {connectionStatus === 'connected' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400">Desired Difficulty</label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={desiredDifficulty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 16;
                            setDesiredDifficulty(val);
                            if (wsRef.current?.readyState === WebSocket.OPEN) {
                              const suggestDiffMsg = {
                                id: 100,
                                method: 'mining.suggest_difficulty',
                                params: [val],
                              };
                              wsRef.current.send(JSON.stringify(suggestDiffMsg));
                              addLog('client', `→ Suggest difficulty: ${val}`);
                            }
                          }}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Default: 16</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Nonce Stride</label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={nonceStride}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setNonceStride(val);
                            if (workerRef.current && currentJob) {
                              workerRef.current.postMessage({
                                type: 'job',
                                data: {
                                  ...currentJob,
                                  extraNonce,
                                  nonceStart: nonceSeedRef.current,
                                  nonceStride: val,
                                },
                              });
                            }
                          }}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Prevents overlap</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={workerState === 'running' ? stopMining : startMining}
                      disabled={workerState === 'error' || workerState === 'starting'}
                      className={`px-6 py-3 rounded-lg font-semibold text-lg transition-colors shadow-lg ${
                        workerState === 'running'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-green-600 hover:bg-green-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={
                        workerState === 'running' ? 'Stop mining' :
                        (!currentJob || !extraNonce || connectionStatus !== 'connected')
                          ? 'Connect to pool and wait for job'
                          : 'Start mining (will submit shares to pool)'
                      }
                    >
                      {workerState === 'running' ? '⏹ Stop Mining' : '▶ Start Mining'}
                      {workerState === 'stopped' && (
                        <span className="ml-2 text-xs block mt-1 opacity-75">
                          {connectionStatus === 'connected' && extraNonce && currentJob
                            ? 'Ready to mine'
                            : 'Needs connection'}
                        </span>
                      )}
                    </button>

                    {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
                      <button
                        onClick={connectWebSocket}
                        className="px-4 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg"
                      >
                        🔌 Connect Pool
                      </button>
                    ) : (
                      <button
                        onClick={disconnectWebSocket}
                        className="px-4 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 transition-colors shadow-lg"
                      >
                        🔌 Disconnect Pool
                      </button>
                    )}
                  </div>
                  
                  {workerState === 'stopped' && (
                    <div className="text-xs text-gray-400 mt-2">
                      {connectionStatus !== 'connected' && '⚠️ Connect to pool first'}
                      {connectionStatus === 'connected' && !extraNonce && '⚠️ Waiting for subscription...'}
                      {connectionStatus === 'connected' && extraNonce && !currentJob && '⚠️ Waiting for job from pool...'}
                      {connectionStatus === 'connected' && extraNonce && currentJob && '✅ Ready to mine'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-400">Connection Status</label>
                  <p className={`font-semibold ${getStatusColor(connectionStatus)}`}>
                    {connectionStatus.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* ExtraNonce Panel */}
            {extraNonce && (
              <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl p-6 shadow-2xl">
                <h2 className="text-2xl font-semibold mb-4 text-white">ExtraNonce</h2>
                <div className="space-y-3 font-mono text-sm">
                  <div>
                    <label className="text-gray-400">extranonce1:</label>
                    <p className="break-all">{extraNonce.extranonce1}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">extranonce2_size:</label>
                    <p>{extraNonce.extranonce2Size}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Current Job Panel */}
            {currentJob && (
              <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl p-6 shadow-2xl">
                <h2 className="text-2xl font-semibold mb-4 text-white">Current Job</h2>
                <div className="space-y-3 font-mono text-sm">
                  <div>
                    <label className="text-gray-400">Job ID:</label>
                    <p className="break-all">{currentJob.jobId}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Prevhash:</label>
                    <p className="break-all">{currentJob.prevhash.substring(0, 32)}...</p>
                  </div>
                  <div>
                    <label className="text-gray-400">coinb1 length:</label>
                    <p>{currentJob.coinb1.length / 2} bytes</p>
                  </div>
                  <div>
                    <label className="text-gray-400">coinb2 length:</label>
                    <p>{currentJob.coinb2.length / 2} bytes</p>
                  </div>
                  <div>
                    <label className="text-gray-400">merkleBranches count:</label>
                    <p>{currentJob.merkleBranches.length}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">version:</label>
                    <p>{currentJob.version}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">nBits:</label>
                    <p>{currentJob.nBits}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">nTime:</label>
                    <p>{currentJob.nTime}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">clean:</label>
                    <p>{currentJob.cleanJobs ? 'true' : 'false'}</p>
                  </div>
                  {currentJob.difficulty && (
                    <div>
                      <label className="text-gray-400">Difficulty:</label>
                      <p>{currentJob.difficulty}</p>
                    </div>
                  )}
                  {currentJob.target && (
                    <div>
                      <label className="text-gray-400">Target (hex):</label>
                      <p className="break-all text-xs">{currentJob.target}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stratum Log */}
          <div className="lg:col-span-1">
            <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-xl p-6 shadow-2xl h-[600px] flex flex-col">
              <h2 className="text-2xl font-semibold mb-4 text-white">Stratum Log</h2>
              <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                  <p className="text-gray-500">No messages yet...</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-gray-500">{log.timestamp}</span>
                      <span className={getLogColor(log.type)}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => setLogs([])}
                className="mt-4 px-3 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors backdrop-blur-sm"
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

