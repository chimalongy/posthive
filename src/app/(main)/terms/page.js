import { Scale, ShieldCheck, AlertCircle, FileText } from 'lucide-react';

export default function TermsPage() {
  const lastUpdated = "May 3, 2026";

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: "By accessing or using PostHive, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our services.",
      icon: ShieldCheck
    },
    {
      title: "2. Description of Service",
      content: "PostHive provides a platform for managing and automating social media posts across multiple platforms. We are not responsible for any content posted by users or for any actions taken by social media platforms against your accounts.",
      icon: FileText
    },
    {
      title: "3. User Conduct",
      content: "You agree not to use PostHive for any unlawful purpose or to violate any laws in your jurisdiction. You are solely responsible for the content you publish through our platform.",
      icon: AlertCircle
    },
    {
      title: "4. Limitation of Liability",
      content: "PostHive shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.",
      icon: Scale
    }
  ];

  return (
    <div className="py-20 px-4 max-w-4xl mx-auto space-y-12">
      <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-8 text-center sm:text-left">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center mx-auto sm:mx-0">
          <Scale className="w-6 h-6" />
        </div>
        <h1 className="text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none space-y-12">
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 italic">
          Please read these terms carefully before using PostHive. Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.
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
          <h2 className="text-lg font-bold mb-4">Termination</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </div>
      </div>
    </div>
  );
}
