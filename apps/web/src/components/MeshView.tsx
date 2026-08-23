import React, { useState } from 'react';
import { Radio, ShieldCheck, ChevronDown, Wifi, Activity, Server } from 'lucide-react';

export const MeshView: React.FC = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const mockPeers = [
    { id: 'peer_1', name: 'Alex', status: 'Connected', signal: 'Strong', hops: 1, transport: 'Local Network (LAN)' },
    { id: 'peer_2', name: 'Sarah', status: 'Relay', signal: 'Good', hops: 2, transport: 'Wi-Fi Direct' },
    { id: 'peer_3', name: 'David', status: 'Searching', signal: 'Weak', hops: 3, transport: 'BLE Mesh' }
  ];

  return (
    <div className="flex-1 bg-dipBg flex flex-col h-full overflow-y-auto p-8 select-none">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header Banner */}
        <div className="bg-dipPanel border border-dipBorder rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-dipSuccess/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-dipSuccess/10 border border-dipSuccess/30 flex items-center justify-center text-dipSuccess">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-dipText flex items-center gap-2">
                  Mesh Network
                </h1>
                <p className="text-sm text-dipSecondary">Decentralized. Resilient. Always Connected.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-dipSuccess/10 border border-dipSuccess/30 text-dipSuccess px-4 py-2 rounded-xl text-sm font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-dipSuccess animate-ping" />
              <span>📡 Mesh Active</span>
            </div>
          </div>
        </div>

        {/* Nearby Peers List */}
        <div className="bg-dipPanel border border-dipBorder rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-dipText flex items-center gap-2">
              <Activity className="w-5 h-5 text-dipPrimary" />
              Nearby Devices
            </h2>
            <span className="text-xs text-dipSecondary font-medium">3 peers found</span>
          </div>

          <div className="space-y-3">
            {mockPeers.map((peer) => (
              <div
                key={peer.id}
                className="bg-dipBg border border-dipBorder rounded-xl p-4 flex items-center justify-between hover:border-dipPrimary/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-dipPrimary/10 border border-dipPrimary/20 flex items-center justify-center text-dipPrimary font-bold text-sm">
                    {peer.name[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-dipText">{peer.name}</h3>
                    <p className="text-xs text-dipSecondary flex items-center gap-1.5 mt-0.5">
                      <Wifi className="w-3 h-3 text-dipSuccess" />
                      <span>{peer.status}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-xs font-semibold text-dipText block">{peer.hops} Hop</span>
                    <span className="text-[10px] text-dipSecondary">{peer.signal} Signal</span>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-dipSuccess" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Diagnostics Toggle */}
        <div className="bg-dipPanel border border-dipBorder rounded-2xl p-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-sm font-semibold text-dipText hover:text-dipPrimary transition-colors"
          >
            <span className="flex items-center gap-2">
              <Server className="w-4 h-4 text-dipSecondary" />
              Advanced Path Details
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-dipBorder text-xs text-dipSecondary space-y-2">
              <p><strong className="text-dipText">Routing Protocol:</strong> Controlled Flooding with Dedup Cache</p>
              <p><strong className="text-dipText">Max TTL:</strong> 10 Hops</p>
              <p><strong className="text-dipText">Courier Store-and-Forward:</strong> Enabled (Capacity: 500 Envelopes)</p>
              <p><strong className="text-dipText">Transport Priority:</strong> Local Network (LAN) &gt; Wi-Fi Direct &gt; BLE</p>
            </div>
          )}
        </div>

        {/* Footnote Guarantee */}
        <div className="flex items-center justify-between text-xs text-dipSecondary pt-2">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-dipSuccess" />
            <span>End-to-End Encrypted Peer Relay</span>
          </div>
          <span>DipChats Protocol v1</span>
        </div>
      </div>
    </div>
  );
};
