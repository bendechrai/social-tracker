/**
 * Unit tests for the Landing Page.
 *
 * Verifies acceptance criteria from landing-page.md:
 * - Page renders at / for unauthenticated visitors
 * - Authenticated users are redirected to /dashboard
 * - CTAs link correctly to /signup and /login
 * - Creator visible with name and photo
 * - Roadmap visible with upcoming platforms and features
 * - Pricing clear with donation model and team plans
 * - Footer has personal attribution with name
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Track redirects
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    // redirect throws in Next.js to halt rendering
    throw new Error("NEXT_REDIRECT");
  },
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import LandingPage from "@/app/(marketing)/page";

describe("Landing Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  describe("rendering", () => {
    it("renders the landing page for unauthenticated visitors", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("Social Tracker")).toBeInTheDocument();
    });

    it("redirects authenticated users to /dashboard", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      await expect(LandingPage()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("hero section", () => {
    it("shows creator name and photo", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("Built by Ben Dechrai")).toBeInTheDocument();
      const img = screen.getByAltText("Ben Dechrai");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://github.com/bendechrai.png");
    });

    it("shows personal origin story", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText(/I built this because I kept missing Reddit threads/)).toBeInTheDocument();
    });

    it("has Try It Out CTA linking to /signup", async () => {
      const page = await LandingPage();
      render(page);

      const tryItOut = screen.getByText("Try It Out");
      expect(tryItOut.closest("a")).toHaveAttribute("href", "/signup");
    });

    it("has Sign In CTA linking to /login", async () => {
      const page = await LandingPage();
      render(page);

      const signIn = screen.getByText("Sign In");
      expect(signIn.closest("a")).toHaveAttribute("href", "/login");
    });
  });

  describe("features section", () => {
    it("renders three feature cards", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("Finds the posts")).toBeInTheDocument();
      expect(screen.getByText("Keeps them organized")).toBeInTheDocument();
      expect(screen.getByText(/Suggests what you/)).toBeInTheDocument();
    });
  });

  describe("roadmap section", () => {
    it("renders roadmap heading", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText(/What's coming/)).toBeInTheDocument();
    });

    it("shows three roadmap items", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("More platforms")).toBeInTheDocument();
      expect(screen.getByText("AI response research")).toBeInTheDocument();
      expect(screen.getByText("Team accounts")).toBeInTheDocument();
    });

    it("mentions upcoming platforms", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText(/Hacker News/)).toBeInTheDocument();
      expect(screen.getByText(/Twitter\/X/)).toBeInTheDocument();
      expect(screen.getByText(/Discord/)).toBeInTheDocument();
      expect(screen.getByText(/Stack Overflow/)).toBeInTheDocument();
    });
  });

  describe("pricing section", () => {
    it("renders pricing heading", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("Pricing")).toBeInTheDocument();
    });

    it("shows BYOK free card", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("Free (BYOK)")).toBeInTheDocument();
      expect(screen.getByText("$0")).toBeInTheDocument();
      expect(screen.getByText(/Bring your own Groq API key/)).toBeInTheDocument();
    });

    it("shows AI credits card with prices", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText("AI Credits")).toBeInTheDocument();
      expect(screen.getByText("$5 / $10 / $20")).toBeInTheDocument();
      expect(screen.getByText(/Choose from premium models/)).toBeInTheDocument();
    });

    it("shows teams coming soon card", async () => {
      const page = await LandingPage();
      render(page);

      expect(screen.getByText(/Teams/)).toBeInTheDocument();
      expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });
  });

  describe("footer", () => {
    it("shows personal attribution with creator name", async () => {
      const page = await LandingPage();
      render(page);

      const footer = screen.getByText(/Made with care by Ben Dechrai/);
      expect(footer).toBeInTheDocument();
      expect(footer.tagName.toLowerCase()).toBe("footer");
    });
  });
});
