import { Shield, Lock, Eye, FileText } from 'lucide-react';

export default function PrivacyPage() {
  const lastUpdated = "May 3, 2026";

  const sections = [
    {
      title: "1. Information We Collect",
      content: "We collect information you provide directly to us when you create an account, connect your social media platforms, or communicate with us. This includes your name, email address, and platform authentication data required to facilitate automated posting.",
      icon: Eye
    },
    {
      title: "2. How We Use Your Data",
      content: "Your data is used solely to provide the services offered by PostHive. We use platform tokens to interact with social media APIs on your behalf. We do not sell your personal data to third parties.",
      icon: FileText
    },
    {
      title: "3. Data Security",
      content: "We implement industry-standard security measures to protect your information. Your authentication tokens are encrypted at rest and transmitted securely using HTTPS.",
      icon: Lock
    }
  ];

  return (
    <div className="py-20 px-4 max-w-4xl mx-auto space-y-12">
      <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-8 text-center sm:text-left">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center mx-auto sm:mx-0">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-4xl font-black tracking-tight">Privacy Policy</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-12">
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 italic">
          At PostHive, we take your privacy seriously. This policy describes how we collect, use, and handle your information when you use our platform.
        </p>

        <div className="grid gap-12">
          {sections.map((section) => (
            <div key={section.title} className="space-y-4 group">
              <div className="flex items-center gap-3">
                <section.icon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold tracking-tight m-0">{section.title}</h2>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed pl-8 border-l-2 border-zinc-100 dark:border-zinc-800 group-hover:border-indigo-600/30 transition-colors">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 p-8 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold mb-4">Questions?</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            If you have any questions about our privacy practices or this policy, please contact us at <span className="text-indigo-600 font-medium">privacy@posthive.app</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
