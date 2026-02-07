import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioIcon, TagIcon, SparklesIcon } from "lucide-react";

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
        <p className="mt-4 text-sm text-muted-foreground">
          Built by one developer who got tired of missing conversations
        </p>
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

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Made with care by a real human
      </footer>
    </div>
  );
}
