/**
 * Unit tests for authentication server actions.
 *
 * These tests verify that auth actions correctly:
 * - Signup: validate email/password, check for duplicates, hash password, create user
 * - ChangePassword: verify current password, validate new password, update hash
 *
 * Uses mocked database and auth session to isolate unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock bcrypt module to avoid slow hashing in tests
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mockedhash"),
    compare: vi.fn().mockImplementation((password: string) => {
      // Simple mock: return true if password contains "correct"
      return Promise.resolve(password.includes("Correct"));
    }),
  },
}));

// Mock database before importing actions
const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...valArgs: unknown[]) => {
          mockValues(...valArgs);
          return {
            returning: (...retArgs: unknown[]) => mockReturning(...retArgs),
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...setArgs: unknown[]) => {
          mockSet(...setArgs);
          return {
            where: (...whereArgs: unknown[]) => {
              mockWhere(...whereArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return {
        where: (...whereArgs: unknown[]) => {
          mockDeleteWhere(...whereArgs);
          return Promise.resolve();
        },
      };
    },
  },
}));

// Mock auth session
const mockAuth = vi.fn();
const mockSignOut = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock email sending
const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock email templates
const mockBuildWelcomeEmail = vi.fn();
vi.mock("@/lib/email-templates", () => ({
  buildWelcomeEmail: (...args: unknown[]) => mockBuildWelcomeEmail(...args),
}));

// Import after mocks are set up
import { signup, changePassword, deleteAccount } from "@/app/actions/auth";

describe("auth server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: returning resolves with a new user id
    mockReturning.mockResolvedValue([{ id: "new-user-id" }]);
    // Default: sendEmail resolves successfully
    mockSendEmail.mockResolvedValue({ success: true });
    // Default: buildWelcomeEmail returns template
    mockBuildWelcomeEmail.mockReturnValue({
      subject: "Welcome to Social Tracker",
      html: "<p>Welcome</p>",
      text: "Welcome",
    });
  });

  describe("signup", () => {
    describe("password matching", () => {
      it("rejects mismatched passwords", async () => {
        const result = await signup(
          "user@example.com",
          "ValidPassword123!",
          "DifferentPassword456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Passwords do not match");
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("email validation", () => {
      it("rejects invalid email format", async () => {
        const result = await signup(
          "not-an-email",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Invalid email address");
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects empty email", async () => {
        const result = await signup(
          "",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Invalid email address");
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("password validation", () => {
      it("rejects password shorter than 12 characters", async () => {
        const result = await signup(
          "user@example.com",
          "Short1!",
          "Short1!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password must be at least 12 characters");
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects password without uppercase letter", async () => {
        const result = await signup(
          "user@example.com",
          "lowercase123456!",
          "lowercase123456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password must contain at least one uppercase letter");
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects password without lowercase letter", async () => {
        const result = await signup(
          "user@example.com",
          "UPPERCASE123456!",
          "UPPERCASE123456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password must contain at least one lowercase letter");
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects password without number", async () => {
        const result = await signup(
          "user@example.com",
          "PasswordNoNumber!",
          "PasswordNoNumber!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password must contain at least one number");
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects password without symbol", async () => {
        const result = await signup(
          "user@example.com",
          "PasswordNoSymbol123",
          "PasswordNoSymbol123"
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Password must contain at least one symbol");
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("duplicate email handling", () => {
      it("rejects duplicate email", async () => {
        mockFindFirst.mockResolvedValueOnce({
          id: "existing-user-id",
          email: "user@example.com",
        });

        const result = await signup(
          "user@example.com",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("An account with this email already exists");
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("successful signup", () => {
      it("creates user with hashed password", async () => {
        mockFindFirst.mockResolvedValueOnce(null); // No existing user

        const result = await signup(
          "newuser@example.com",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(result.success).toBe(true);
        expect(mockInsert).toHaveBeenCalled();
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "newuser@example.com",
            passwordHash: expect.any(String),
          })
        );
      });

      it("normalizes email to lowercase", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        await signup(
          "User@Example.COM",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "user@example.com",
          })
        );
      });

      it("sends welcome email after user creation", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await signup(
          "newuser@example.com",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(result.success).toBe(true);
        expect(mockBuildWelcomeEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "new-user-id",
          })
        );
        expect(mockSendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "newuser@example.com",
            subject: "Welcome to Social Tracker",
          })
        );
      });

      it("succeeds even when welcome email fails", async () => {
        mockFindFirst.mockResolvedValueOnce(null);
        mockSendEmail.mockRejectedValueOnce(new Error("SMTP connection failed"));

        const result = await signup(
          "newuser@example.com",
          "ValidPassword123!",
          "ValidPassword123!"
        );

        expect(result.success).toBe(true);
        expect(mockInsert).toHaveBeenCalled();
      });
    });
  });

  describe("changePassword", () => {
    describe("authentication", () => {
      it("rejects unauthenticated user", async () => {
        mockAuth.mockResolvedValueOnce(null);

        const result = await changePassword(
          "CurrentPassword123!",
          "NewPassword456!",
          "NewPassword456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Not authenticated");
        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("rejects session without user id", async () => {
        mockAuth.mockResolvedValueOnce({ user: { email: "user@example.com" } });

        const result = await changePassword(
          "CurrentPassword123!",
          "NewPassword456!",
          "NewPassword456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Not authenticated");
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe("password matching", () => {
      it("rejects mismatched new passwords", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });

        const result = await changePassword(
          "CurrentPassword123!",
          "NewPassword456!",
          "DifferentPassword789!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("New passwords do not match");
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe("new password validation", () => {
      it("rejects weak new password", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });

        const result = await changePassword(
          "CurrentPassword123!",
          "weak",
          "weak"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Password must be at least 12 characters");
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe("current password verification", () => {
      it("rejects incorrect current password", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockFindFirst.mockResolvedValueOnce({
          id: "user-id",
          email: "user@example.com",
          passwordHash: "$2b$12$existinghash",
        });

        const result = await changePassword(
          "WrongPassword123!",
          "NewPassword456!",
          "NewPassword456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("Current password is incorrect");
        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("handles user not found", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await changePassword(
          "CurrentPassword123!",
          "NewPassword456!",
          "NewPassword456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("User not found or no password set");
        expect(mockUpdate).not.toHaveBeenCalled();
      });

      it("handles user without password hash", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockFindFirst.mockResolvedValueOnce({
          id: "user-id",
          email: "user@example.com",
          passwordHash: null,
        });

        const result = await changePassword(
          "CurrentPassword123!",
          "NewPassword456!",
          "NewPassword456!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("User not found or no password set");
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe("same password check", () => {
      it("rejects same password", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockFindFirst.mockResolvedValueOnce({
          id: "user-id",
          email: "user@example.com",
          passwordHash: "$2b$12$existinghash",
        });

        const result = await changePassword(
          "CorrectPassword123!",
          "CorrectPassword123!",
          "CorrectPassword123!"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("New password must be different from current password");
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    describe("successful password change", () => {
      it("updates password hash and sets passwordChangedAt", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockFindFirst.mockResolvedValueOnce({
          id: "user-id",
          email: "user@example.com",
          passwordHash: "$2b$12$existinghash",
        });

        const result = await changePassword(
          "CorrectPassword123!",
          "NewValidPassword456!",
          "NewValidPassword456!"
        );

        expect(result.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(
          expect.objectContaining({
            passwordHash: expect.any(String),
            passwordChangedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          })
        );
      });
    });
  });

  describe("deleteAccount", () => {
    describe("authentication", () => {
      it("rejects unauthenticated user", async () => {
        mockAuth.mockResolvedValueOnce(null);

        const result = await deleteAccount("user@example.com");

        expect(result.success).toBe(false);
        expect(result.error).toBe("Not authenticated");
        expect(mockDelete).not.toHaveBeenCalled();
      });

      it("rejects session without user id", async () => {
        mockAuth.mockResolvedValueOnce({ user: { email: "user@example.com" } });

        const result = await deleteAccount("user@example.com");

        expect(result.success).toBe(false);
        expect(result.error).toBe("Not authenticated");
        expect(mockDelete).not.toHaveBeenCalled();
      });
    });

    describe("email confirmation", () => {
      it("rejects when email does not match", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });

        const result = await deleteAccount("wrong@example.com");

        expect(result.success).toBe(false);
        expect(result.error).toBe("Email does not match your account");
        expect(mockDelete).not.toHaveBeenCalled();
      });

      it("matches email case-insensitively", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockSignOut.mockResolvedValueOnce(undefined);

        const result = await deleteAccount("User@Example.COM");

        expect(result.success).toBe(true);
        expect(mockDelete).toHaveBeenCalled();
      });
    });

    describe("successful deletion", () => {
      it("deletes user and signs out", async () => {
        mockAuth.mockResolvedValueOnce({
          user: { id: "user-id", email: "user@example.com" },
        });
        mockSignOut.mockResolvedValueOnce(undefined);

        const result = await deleteAccount("user@example.com");

        expect(result.success).toBe(true);
        expect(mockDelete).toHaveBeenCalled();
        expect(mockDeleteWhere).toHaveBeenCalled();
        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
      });
    });
  });
});
