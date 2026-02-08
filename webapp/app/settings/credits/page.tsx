"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreditBalance,
  useUsageSummary,
  useUsageHistory,
  usePurchaseHistory,
  useCreateCheckoutSession,
} from "@/lib/hooks";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { Loader2Icon, CreditCardIcon, BarChart3Icon } from "lucide-react";

export default function CreditsPage() {
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();
  const { data: summary } = useUsageSummary();
  const [historyPage, setHistoryPage] = React.useState(1);
  const { data: history, isLoading: historyLoading } = useUsageHistory(historyPage);
  const { data: purchases } = usePurchaseHistory();
  const checkout = useCreateCheckoutSession();

  const handleBuyCredits = async (amountCents: number) => {
    const result = await checkout.mutateAsync(amountCents);
    if ("url" in result) {
      window.location.assign(result.url);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Credits & Usage</h2>

      {/* Balance */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              {balanceLoading ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <p className="text-3xl font-bold">
                  ${((balance ?? 0) / 100).toFixed(2)}
                </p>
              )}
            </div>
            <CreditCardIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div>
        <h3 className="text-lg font-medium mb-3">Buy Credits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.amountCents}>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold mb-1">{pack.label}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  ${(pack.creditsCents / 100).toFixed(2)} in AI credits
                </p>
                <Button
                  className="w-full"
                  onClick={() => handleBuyCredits(pack.amountCents)}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    "Buy"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Usage Chart */}
      {summary && summary.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <BarChart3Icon className="h-5 w-5" />
            Daily Usage (Last 30 Days)
          </h3>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {summary.map((day: { date: string; costCents: number }) => {
                  const maxCost = Math.max(...summary.map((d: { costCents: number }) => d.costCents));
                  const height = maxCost > 0 ? (day.costCents / maxCost) * 100 : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 bg-primary rounded-t-sm"
                      style={{ height: `${Math.max(2, height)}%` }}
                      title={`${day.date}: $${(day.costCents / 100).toFixed(2)}`}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage History */}
      <div>
        <h3 className="text-lg font-medium mb-3">Usage History</h3>
        <Card>
          <CardContent className="p-6">
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : history && history.entries.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Date</th>
                        <th className="text-left py-2 font-medium">Model</th>
                        <th className="text-right py-2 font-medium">Tokens</th>
                        <th className="text-right py-2 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.entries.map((entry: {
                        id: string;
                        createdAt: Date;
                        modelId: string;
                        promptTokens: number;
                        completionTokens: number;
                        costCents: number;
                      }) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-2">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {entry.modelId.split("/").pop()}
                          </td>
                          <td className="py-2 text-right">
                            {entry.promptTokens + entry.completionTokens}
                          </td>
                          <td className="py-2 text-right">
                            ${(entry.costCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {history.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center text-sm text-muted-foreground">
                      Page {history.page} of {history.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage((p) => p + 1)}
                      disabled={historyPage >= history.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No usage history yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Purchase History */}
      {purchases && purchases.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Purchase History</h3>
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                      <th className="text-right py-2 font-medium">Credits</th>
                      <th className="text-right py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase: {
                      id: string;
                      createdAt: Date;
                      amountCents: number;
                      creditsCents: number;
                      status: string;
                    }) => (
                      <tr key={purchase.id} className="border-b last:border-0">
                        <td className="py-2">
                          {new Date(purchase.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right">
                          ${(purchase.amountCents / 100).toFixed(2)}
                        </td>
                        <td className="py-2 text-right">
                          ${(purchase.creditsCents / 100).toFixed(2)}
                        </td>
                        <td className="py-2 text-right capitalize">
                          {purchase.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
