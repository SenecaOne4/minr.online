import axios from 'axios';

const BLOCKSTREAM_API_URL = process.env.BLOCKSTREAM_API_URL || 'https://blockstream.info/api';
const BLOCKCYPHER_API_KEY = process.env.BLOCKCYPHER_API_KEY;
const BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'mainnet';

interface Transaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  vin: Array<{
    prevout: {
      value: number;
    };
  }>;
  vout: Array<{
    value: number;
    scriptpubkey_address?: string;
  }>;
}

/**
 * Check if a Bitcoin address has received transactions
 * Uses Blockstream API (free, no key needed) or BlockCypher
 */
export async function checkAddressTransactions(
  address: string
): Promise<Transaction[]> {
  try {
    if (BLOCKCYPHER_API_KEY) {
      return await checkAddressWithBlockCypher(address);
    } else {
      return await checkAddressWithBlockstream(address);
    }
  } catch (error: any) {
    console.error('[bitcoinApi] Error checking address:', error.message);
    throw error;
  }
}

/**
 * Check address using Blockstream API (free, no API key)
 */
async function checkAddressWithBlockstream(address: string): Promise<Transaction[]> {
  const networkPrefix = BITCOIN_NETWORK === 'testnet' ? 'testnet/' : '';
  const url = `${BLOCKSTREAM_API_URL}/${networkPrefix}address/${address}/txs`;

  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'Accept': 'application/json',
    },
  });

  return response.data || [];
}

/**
 * Check address using BlockCypher API (requires API key)
 */
async function checkAddressWithBlockCypher(address: string): Promise<Transaction[]> {
  const network = BITCOIN_NETWORK === 'testnet' ? 'btc-test3' : 'btc';
  const url = `https://api.blockcypher.com/v1/${network}/main/addrs/${address}/txs`;

  const response = await axios.get(url, {
    timeout: 10000,
    params: {
      token: BLOCKCYPHER_API_KEY,
    },
  });

  // Transform BlockCypher response to match our Transaction interface
  return (response.data.txs || []).map((tx: any) => ({
    txid: tx.hash,
    status: {
      confirmed: tx.confirmations > 0,
      block_height: tx.block_height,
      block_hash: tx.block_hash,
      block_time: tx.confirmed ? new Date(tx.confirmed).getTime() / 1000 : undefined,
    },
    vin: tx.inputs || [],
    vout: tx.outputs || [],
  }));
}

/**
 * Get transaction details by hash
 */
export async function getTransaction(txHash: string): Promise<Transaction | null> {
  try {
    if (BLOCKCYPHER_API_KEY) {
      return await getTransactionWithBlockCypher(txHash);
    } else {
      return await getTransactionWithBlockstream(txHash);
    }
  } catch (error: any) {
    console.error('[bitcoinApi] Error getting transaction:', error.message);
    return null;
  }
}

async function getTransactionWithBlockstream(txHash: string): Promise<Transaction | null> {
  const networkPrefix = BITCOIN_NETWORK === 'testnet' ? 'testnet/' : '';
  const url = `${BLOCKSTREAM_API_URL}/${networkPrefix}tx/${txHash}`;

  const response = await axios.get(url, {
    timeout: 10000,
  });

  return response.data;
}

async function getTransactionWithBlockCypher(txHash: string): Promise<Transaction | null> {
  const network = BITCOIN_NETWORK === 'testnet' ? 'btc-test3' : 'btc';
  const url = `https://api.blockcypher.com/v1/${network}/main/txs/${txHash}`;

  const response = await axios.get(url, {
    timeout: 10000,
    params: {
      token: BLOCKCYPHER_API_KEY,
    },
  });

  return {
    txid: response.data.hash,
    status: {
      confirmed: response.data.confirmations > 0,
      block_height: response.data.block_height,
      block_hash: response.data.block_hash,
      block_time: response.data.confirmed ? new Date(response.data.confirmed).getTime() / 1000 : undefined,
    },
    vin: response.data.inputs || [],
    vout: response.data.outputs || [],
  };
}

/**
 * Calculate total received amount for an address from transactions
 */
export function calculateReceivedAmount(
  transactions: Transaction[],
  address: string
): number {
  let total = 0;

  for (const tx of transactions) {
    for (const vout of tx.vout) {
      if (vout.scriptpubkey_address === address) {
        // Convert satoshis to BTC (Blockstream returns in satoshis)
        total += vout.value / 100000000;
      }
    }
  }

  return total;
}

