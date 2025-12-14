# Payment Gateway Setup

Minr.online uses a Bitcoin payment gateway for the $1 USD entry fee.

## Overview

- **Entry Fee**: $1.00 USD
- **Payment Method**: Bitcoin (BTC)
- **Payment Expiry**: 24 hours
- **Confirmation Required**: 1 block confirmation
- **API**: Blockstream (free) or BlockCypher (optional)

## Configuration

### Environment Variables

Set these in your backend `.env`:

```bash
# Bitcoin API (choose one)
BLOCKSTREAM_API_URL=https://blockstream.info/api  # Free, no key needed
# OR
BLOCKCYPHER_API_KEY=your-key-here  # Optional, requires API key

# Payment Settings
BITCOIN_NETWORK=mainnet  # or testnet for development
PAYMENT_EXPIRY_HOURS=24
ENTRY_FEE_USD=1.00
PAYMENT_CONFIRMATIONS=1
```

### Payment Flow

1. User requests payment → Backend generates unique Bitcoin address
2. User sends BTC to address → Payment verifier checks blockchain
3. Payment confirmed → User profile updated with `has_paid_entry_fee = true`
4. User can now mine → Access to mining features unlocked

## Payment Verification Service

The payment verifier runs as a background service:

- **Poll Interval**: Every 30 seconds
- **Checks**: Pending payment requests
- **Actions**: Verifies transactions, updates status, grants access

## Testing

### Testnet Mode

For development, use testnet:

```bash
BITCOIN_NETWORK=testnet
```

Get testnet BTC from a faucet:
- https://testnet-faucet.mempool.co/
- https://bitcoinfaucet.uo1.net/

### Manual Verification

Admins can manually verify payments via:
```
POST /api/admin/payments/verify/:id
{
  "tx_hash": "transaction-hash-here"
}
```

## Monitoring

Check payment status:
- User dashboard shows payment gate if not paid
- Admin panel shows all payment requests
- Payment history available via `/api/payments/history`

## Troubleshooting

### Payments Not Detected

- Check payment verifier service is running
- Verify Bitcoin API is accessible
- Check payment address matches exactly
- Ensure sufficient confirmations

### Expired Payments

- Payments expire after 24 hours
- Users can create new payment requests
- Expired requests are automatically marked

## Security

- Payment addresses are unique per request
- Addresses are monitored via blockchain APIs
- No private keys stored on server
- All transactions are publicly verifiable

