import { UserMenu } from "@/components/user-menu";

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Social Tracker</h1>
        <UserMenu />
      </div>
    </header>
  );
}
