import Link from 'next/link';
import { Hexagon, CheckCircle2, Users, Rocket, Globe } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="py-20 px-4 max-w-5xl mx-auto space-y-24">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
          Our Mission
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
          Simplifying the way the <span className="text-indigo-600">world creates</span>.
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-3xl mx-auto">
          PostHive was built with a single goal in mind: to empower creators and businesses by providing a unified platform to manage, automate, and scale their social media presence across every major network.
        </p>
      </section>

      {/* Values Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Rocket className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold">Innovation First</h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            We are constantly pushing the boundaries of what's possible in content automation. From AI-driven insights to seamless multi-platform integration, we build for the future of digital expression.
          </p>
        </div>
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold">Community Focused</h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Our users are at the heart of everything we do. We listen, adapt, and evolve based on the feedback of the thousands of creators who call PostHive their home base.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="rounded-3xl bg-zinc-900 dark:bg-zinc-800 p-12 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
          <div className="text-center">
            <div className="text-4xl font-black mb-1">50M+</div>
            <div className="text-xs text-zinc-400 font-medium uppercase">Posts Published</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black mb-1">100K</div>
            <div className="text-xs text-zinc-400 font-medium uppercase">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black mb-1">15+</div>
            <div className="text-xs text-zinc-400 font-medium uppercase">Platforms</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black mb-1">24/7</div>
            <div className="text-xs text-zinc-400 font-medium uppercase">Automation</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-8 py-12">
        <h2 className="text-3xl font-bold italic">Ready to join the hive?</h2>
        <Link 
          href="/register" 
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all hover:scale-105 shadow-xl shadow-indigo-600/20"
        >
          Start Your Journey <Rocket className="w-5 h-5" />
        </Link>
      </section>
    </div>
  );
}
