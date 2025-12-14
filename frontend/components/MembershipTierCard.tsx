'use client';

interface MembershipTierCardProps {
  membership: {
    id: string;
    status: string;
    expires_at: string | null;
  } | null;
  isExempt?: boolean;
  isAdmin?: boolean;
}

export default function MembershipTierCard({ membership, isExempt, isAdmin }: MembershipTierCardProps) {
  const calculateTimeRemaining = (expiresAt: string | null): string | null => {
    if (!expiresAt) return null;
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} remaining`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
    return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
  };

  if (isExempt || isAdmin) {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-yellow-500/20 to-white/10 border-2 border-yellow-400/50 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Membership</h2>
          <span className="px-3 py-1 bg-yellow-500/30 text-yellow-200 rounded-lg text-sm font-semibold border border-yellow-400/50">
            EXEMPT
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-400">Status</p>
            <p className="text-lg font-semibold text-yellow-300">Exempt from Entry Fee</p>
          </div>
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs text-gray-400 mb-2">Benefits:</p>
            <ul className="space-y-1 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Access to browser miner
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Desktop miner download
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Lottery pool participation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                BTC rewards when blocks found
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 via-blue-500/10 to-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-white">Membership</h2>
        <div className="space-y-4">
          <p className="text-gray-400">No active membership</p>
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs text-gray-400 mb-2">Entry Tier Benefits ($1 USD):</p>
            <ul className="space-y-1 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-blue-400">•</span>
                Access to browser miner
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">•</span>
                Desktop miner download
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">•</span>
                Lottery pool participation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">•</span>
                BTC rewards when blocks found
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const timeRemaining = calculateTimeRemaining(membership.expires_at);
  const isActive = membership.status === 'active';

  return (
    <div className={`backdrop-blur-xl bg-gradient-to-br from-white/10 via-blue-500/10 to-white/10 border-2 rounded-2xl p-6 shadow-2xl ${
      isActive ? 'border-green-400/50' : 'border-red-400/50'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Membership</h2>
        <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${
          isActive 
            ? 'bg-green-500/30 text-green-200 border-green-400/50' 
            : 'bg-red-500/30 text-red-200 border-red-400/50'
        }`}>
          {membership.status.toUpperCase()}
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-400">Tier</p>
          <p className="text-lg font-semibold text-white">Entry Tier ($1 USD)</p>
        </div>
        {membership.expires_at && (
          <div>
            <p className="text-sm text-gray-400">Expires</p>
            <p className="text-lg text-white">
              {new Date(membership.expires_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            {timeRemaining && (
              <p className={`text-sm mt-1 ${
                isActive ? 'text-green-300' : 'text-red-300'
              }`}>
                {timeRemaining}
              </p>
            )}
          </div>
        )}
        <div className="pt-3 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">Benefits:</p>
          <ul className="space-y-1 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className={isActive ? 'text-green-400' : 'text-gray-500'}>✓</span>
              Access to browser miner
            </li>
            <li className="flex items-center gap-2">
              <span className={isActive ? 'text-green-400' : 'text-gray-500'}>✓</span>
              Desktop miner download
            </li>
            <li className="flex items-center gap-2">
              <span className={isActive ? 'text-green-400' : 'text-gray-500'}>✓</span>
              Lottery pool participation
            </li>
            <li className="flex items-center gap-2">
              <span className={isActive ? 'text-green-400' : 'text-gray-500'}>✓</span>
              BTC rewards when blocks found
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

