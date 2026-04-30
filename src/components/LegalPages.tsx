interface LegalPageProps {
  onBack: () => void;
}

export function TermsPage({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 overflow-y-auto">
      <img src="/logo.png" alt="STONE" className="h-24 object-contain cursor-pointer mb-6" onClick={onBack} />
      <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-lg w-full">
        <h1 className="text-white font-heading text-xl mb-4">Terms of Service</h1>
        <div className="text-white/70 text-sm space-y-3">
          <p><strong>Last updated:</strong> April 2026</p>
          <p>By using STONE ("the Game"), you agree to these terms.</p>
          <h2 className="text-white font-heading text-base pt-2">1. Use of the Game</h2>
          <p>STONE is a free-to-play online board game. You may play for personal, non-commercial use. You must be at least 13 years old to create an account.</p>
          <h2 className="text-white font-heading text-base pt-2">2. Accounts</h2>
          <p>You are responsible for keeping your password secure. Each person should have only one account. We reserve the right to remove accounts that violate these terms.</p>
          <h2 className="text-white font-heading text-base pt-2">3. Conduct</h2>
          <p>You agree not to use offensive usernames, harass other players, or attempt to manipulate game data. We may suspend accounts that violate community standards.</p>
          <h2 className="text-white font-heading text-base pt-2">4. Intellectual Property</h2>
          <p>All game content, artwork, and code are owned by Stone The Game. You may not copy, modify, or redistribute any part of the game.</p>
          <h2 className="text-white font-heading text-base pt-2">5. Disclaimer</h2>
          <p>The game is provided "as is" without warranties. We are not liable for data loss, service interruptions, or any damages arising from use of the game.</p>
          <h2 className="text-white font-heading text-base pt-2">6. Changes</h2>
          <p>We may update these terms at any time. Continued use of the game constitutes acceptance of updated terms.</p>
          <h2 className="text-white font-heading text-base pt-2">7. Contact</h2>
          <p>Questions? Email us at <a href="mailto:support@stonethegame.com" className="text-amber-400 hover:text-amber-300">support@stonethegame.com</a></p>
        </div>
        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-6 block mx-auto">
          Back
        </button>
      </div>
    </div>
  );
}

export function PrivacyPage({ onBack }: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 overflow-y-auto">
      <img src="/logo.png" alt="STONE" className="h-24 object-contain cursor-pointer mb-6" onClick={onBack} />
      <div className="bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-lg w-full">
        <h1 className="text-white font-heading text-xl mb-4">Privacy Policy</h1>
        <div className="text-white/70 text-sm space-y-3">
          <p><strong>Last updated:</strong> April 2026</p>
          <p>Your privacy matters to us. This policy explains what data we collect and how we use it.</p>
          <h2 className="text-white font-heading text-base pt-2">1. Data We Collect</h2>
          <p><strong>Account data:</strong> Username, password (stored securely as a hash), and optional profile picture.</p>
          <p><strong>Game data:</strong> Game history, stats (wins, losses, captures), chat messages, and friend connections.</p>
          <p><strong>Device data:</strong> A randomly generated device token stored in your browser to keep you logged in.</p>
          <p><strong>Analytics:</strong> We use Vercel Analytics to collect anonymized usage data (page views, performance metrics). No personal data is shared with analytics.</p>
          <h2 className="text-white font-heading text-base pt-2">2. How We Use Your Data</h2>
          <p>Your data is used solely to operate the game: maintaining your account, tracking game progress, enabling multiplayer features, and improving performance.</p>
          <h2 className="text-white font-heading text-base pt-2">3. Data Sharing</h2>
          <p>We do not sell your data. Your username and stats are visible to other players on the leaderboard and in games. We use Supabase for data storage and Vercel for hosting.</p>
          <h2 className="text-white font-heading text-base pt-2">4. Data Retention</h2>
          <p>Your data is retained as long as your account exists. You may request account deletion by contacting us.</p>
          <h2 className="text-white font-heading text-base pt-2">5. Security</h2>
          <p>Passwords are hashed before storage. All data transmission uses HTTPS encryption.</p>
          <h2 className="text-white font-heading text-base pt-2">6. Children</h2>
          <p>The game is not intended for children under 13. We do not knowingly collect data from children under 13.</p>
          <h2 className="text-white font-heading text-base pt-2">7. Contact</h2>
          <p>Privacy questions? Email <a href="mailto:support@stonethegame.com" className="text-amber-400 hover:text-amber-300">support@stonethegame.com</a></p>
        </div>
        <button onClick={onBack}
          className="text-white/40 text-xs hover:text-white/70 transition-colors cursor-pointer mt-6 block mx-auto">
          Back
        </button>
      </div>
    </div>
  );
}
