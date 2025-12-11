'use client';

import { useState, useEffect, useRef } from 'react';

interface CurrentJob {
  jobId: string;
  prevhash: string;
  nTime: string;
  nBits: string;
  difficulty?: number;
}

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'info' | 'client' | 'pool' | 'error' | 'demo';
  message: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const PAYOUT_ADDRESS = 'bc1qchm0vkcdkzrstlh05w5zd7j5788yysyfmnlf47';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.minr.online/ws/stratum-browser';

export default function MinerPlayground() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isMining, setIsMining] = useState(false);
  const [hashesPerSecond, setHashesPerSecond] = useState(0);
  const [totalHashes, setTotalHashes] = useState(0);
  const [fakeShares, setFakeShares] = useState(0);
  const [currentJob, setCurrentJob] = useState<CurrentJob | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const miningLoopRef = useRef<number | null>(null);
  const hashCountRef = useRef(0);
  const lastHashTimeRef = useRef(Date.now());
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

  // WebSocket connection management
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (miningLoopRef.current !== null) {
        cancelAnimationFrame(miningLoopRef.current);
      }
    };
  }, []);

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

        // Try to parse as JSON
        try {
          const parsed = JSON.parse(data);

          // Handle mining.notify
          if (parsed.method === 'mining.notify') {
            const params = parsed.params || [];
            if (params.length >= 5) {
              const job: CurrentJob = {
                jobId: params[0] || '',
                prevhash: params[1] || '',
                nTime: params[2] || '',
                nBits: params[3] || '',
                difficulty: difficulty || undefined,
              };
              setCurrentJob(job);
              addLog('info', `New job received: ${job.jobId}`);
            }
          }

          // Handle mining.set_difficulty
          if (parsed.method === 'mining.set_difficulty') {
            const newDifficulty = parsed.params?.[0];
            if (typeof newDifficulty === 'number') {
              setDifficulty(newDifficulty);
              setCurrentJob((prev) =>
                prev ? { ...prev, difficulty: newDifficulty } : null
              );
              addLog('info', `Difficulty set to: ${newDifficulty}`);
            }
          }

          // Handle other responses
          if (parsed.result || parsed.error) {
            addLog('pool', `Response: ${JSON.stringify(parsed)}`);
          }
        } catch (parseError) {
          // Not JSON or parse failed - already logged as raw text
        }
      };

      ws.onerror = (error) => {
        setConnectionStatus('error');
        addLog('error', 'WebSocket error occurred');
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        addLog('info', 'WebSocket disconnected');
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

  // Double SHA-256 hash function
  const doubleSha256 = async (input: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // First SHA-256
    const hash1 = await crypto.subtle.digest('SHA-256', data);
    // Second SHA-256
    const hash2 = await crypto.subtle.digest('SHA-256', hash1);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hash2));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Demo mining loop
  useEffect(() => {
    if (!isMining) {
      if (miningLoopRef.current !== null) {
        cancelAnimationFrame(miningLoopRef.current);
        miningLoopRef.current = null;
      }
      return;
    }

    let nonce = 0;
    const startTime = Date.now();

    const mine = async () => {
      // Build job string from current job or use default
      let jobString: string;
      if (currentJob) {
        jobString = `${currentJob.jobId}|${currentJob.prevhash}|${currentJob.nTime}|${currentJob.nBits}|${nonce}`;
      } else {
        // Fallback to default string
        jobString = `GarciaFamilyBlock|${Date.now()}|${nonce}`;
      }

      try {
        const hash = await doubleSha256(jobString);
        hashCountRef.current++;

        // Update hash rate every second
        const now = Date.now();
        const elapsed = (now - lastHashTimeRef.current) / 1000;
        if (elapsed >= 1) {
          const hps = hashCountRef.current / elapsed;
          setHashesPerSecond(Math.round(hps));
          setTotalHashes(hashCountRef.current);
          hashCountRef.current = 0;
          lastHashTimeRef.current = now;
        }

        // Toy difficulty check: look for hash starting with "0000" (very easy)
        if (hash.startsWith('0000')) {
          setFakeShares((prev) => prev + 1);
          addLog('demo', `🎉 Fake share found! Hash: ${hash.substring(0, 16)}... (toy target)`);
        }

        nonce++;
      } catch (error) {
        console.error('Mining error:', error);
      }

      // Continue mining loop
      if (isMining) {
        miningLoopRef.current = requestAnimationFrame(() => {
          mine();
        });
      }
    };

    // Start mining
    miningLoopRef.current = requestAnimationFrame(() => {
      mine();
    });

    return () => {
      if (miningLoopRef.current !== null) {
        cancelAnimationFrame(miningLoopRef.current);
        miningLoopRef.current = null;
      }
    };
  }, [isMining, currentJob]);

  const startMining = () => {
    setIsMining(true);
    addLog('demo', 'Demo mining started');
  };

  const stopMining = () => {
    setIsMining(false);
    addLog('demo', 'Demo mining stopped');
  };

  // Helper function for future real share submission (TODO)
  function submitShare(nonce: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    // TODO: Wire with real job data and user identity
    const msg = {
      id: 3,
      method: 'mining.submit',
      params: [
        'worker-id-here', // to be wired with real identity later
        currentJob?.jobId || 'jobId',
        'extraNonce2',
        currentJob?.nTime || 'ntime',
        nonce,
      ],
    };
    wsRef.current.send(JSON.stringify(msg));
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">Minr.online</h1>
          <p className="text-gray-400">Family Bitcoin-Style Miner</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4">Mining Dashboard</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Payout Address</label>
                  <p className="font-mono text-sm break-all">{PAYOUT_ADDRESS}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Hashrate</label>
                    <p className="text-2xl font-bold">{hashesPerSecond.toLocaleString()} H/s</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Total Hashes</label>
                    <p className="text-2xl font-bold">{totalHashes.toLocaleString()}</p>
                  </div>
                </div>

                {fakeShares > 0 && (
                  <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3">
                    <p className="text-yellow-400">
                      🎉 Fake Shares Found: <span className="font-bold">{fakeShares}</span>
                    </p>
                    <p className="text-xs text-yellow-300 mt-1">
                      (Toy target - not real pool validation)
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={isMining ? stopMining : startMining}
                    disabled={connectionStatus === 'connecting'}
                    className={`px-4 py-2 rounded font-semibold ${
                      isMining
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isMining ? 'Stop Demo Mining' : 'Start Demo Mining'}
                  </button>

                  {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
                    <button
                      onClick={connectWebSocket}
                      className="px-4 py-2 rounded font-semibold bg-blue-600 hover:bg-blue-700"
                    >
                      Connect Real Pool
                    </button>
                  ) : (
                    <button
                      onClick={disconnectWebSocket}
                      className="px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700"
                    >
                      Disconnect Real Pool
                    </button>
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

            {/* Current Job Panel */}
            {currentJob && (
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Current Job</h2>
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
                    <label className="text-gray-400">nTime:</label>
                    <p>{currentJob.nTime}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">nBits:</label>
                    <p>{currentJob.nBits}</p>
                  </div>
                  {currentJob.difficulty && (
                    <div>
                      <label className="text-gray-400">Difficulty:</label>
                      <p>{currentJob.difficulty}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stratum Log */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg h-[600px] flex flex-col">
              <h2 className="text-2xl font-semibold mb-4">Stratum Log</h2>
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
                className="mt-4 px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
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

