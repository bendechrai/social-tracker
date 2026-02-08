import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  RadioIcon,
  TagIcon,
  SparklesIcon,
  GlobeIcon,
  BrainIcon,
  UsersIcon,
  KeyIcon,
  CreditCardIcon,
} from "lucide-react";

export default async function LandingPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Social Tracker
        </h1>
        <div className="mt-6 flex items-center gap-3">
          <Image
            src="https://github.com/bendechrai.png"
            alt="Ben Dechrai"
            width={40}
            height={40}
            className="rounded-full"
          />
          <p className="text-sm text-muted-foreground">
            Built by Ben Dechrai
          </p>
        </div>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          I built this because I kept missing Reddit threads where people were
          asking about things I could actually help with. Now I don&apos;t.
          Maybe it&apos;ll help you too.
        </p>
        <div className="mt-10 flex gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Try It Out</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </main>

      {/* How it works */}
      <section className="px-4 pb-20">
        <h2 className="text-center text-2xl font-semibold mb-2">
          Here&apos;s what it does
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-10 max-w-lg mx-auto">
          No fluff. Three things, and it does them well.
        </p>
        <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <RadioIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Finds the posts</h3>
              <p className="text-sm text-muted-foreground">
                Pick your subreddits and search terms. It watches for matching
                posts so you don&apos;t have to refresh Reddit all day.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <TagIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Keeps them organized</h3>
              <p className="text-sm text-muted-foreground">
                Color-coded tags group your search terms by topic.
                Filter, review, and mark posts as you go through them.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <SparklesIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Suggests what you&apos;re missing</h3>
              <p className="text-sm text-muted-foreground">
                AI looks at your existing terms and suggests new ones
                you probably haven&apos;t thought of. Genuinely useful.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What's Coming */}
      <section className="px-4 pb-20">
        <h2 className="text-center text-2xl font-semibold mb-2">
          What&apos;s coming
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-10 max-w-lg mx-auto">
          This is just the beginning. Here&apos;s what&apos;s next.
        </p>
        <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <GlobeIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">More platforms</h3>
              <p className="text-sm text-muted-foreground">
                Hacker News, Twitter/X, Discord, Stack Overflow.
                Same workflow, more places to listen.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <BrainIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">AI response research</h3>
              <p className="text-sm text-muted-foreground">
                For each post, get AI-generated context, relevant talking
                points, and a draft reply to help you respond faster.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <UsersIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Team accounts</h3>
              <p className="text-sm text-muted-foreground">
                Shared dashboards, assigned posts, and team analytics
                for DevRel and marketing teams.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 pb-20">
        <h2 className="text-center text-2xl font-semibold mb-2">
          Pricing
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-10 max-w-lg mx-auto">
          Free to use with your own API key, or buy credits for premium AI models.
        </p>
        <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <KeyIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Free (BYOK)</h3>
              <p className="text-3xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground">
                Bring your own Groq API key. Unlimited usage, no credit card needed.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <CreditCardIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">AI Credits</h3>
              <p className="text-3xl font-bold">$5 / $10 / $20</p>
              <p className="text-sm text-muted-foreground">
                Choose from premium models. Buy credit packs starting at $5.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <UsersIcon className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Teams &amp; Enterprise</h3>
              <p className="text-3xl font-bold text-muted-foreground">Coming soon</p>
              <p className="text-sm text-muted-foreground">
                Shared dashboards, team management, and priority support.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Made with care by Ben Dechrai
      </footer>
    </div>
  );
}
