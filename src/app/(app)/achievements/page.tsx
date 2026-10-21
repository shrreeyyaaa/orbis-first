import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { PageHeader } from "@/components/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Flag,
  Layers,
  Shield,
  Landmark,
  Globe,
  Target,
  TrendingUp,
  Gem,
  Medal,
  Award,
  Crown,
  Trophy,
  Lock,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flag: Flag,
  layers: Layers,
  shield: Shield,
  landmark: Landmark,
  globe: Globe,
  target: Target,
  "trending-up": TrendingUp,
  gem: Gem,
  medal: Medal,
  award: Award,
  crown: Crown,
};

function level(count: number): { name: string; next: number } {
  if (count >= 11) return { name: "Patriarch", next: 12 };
  if (count >= 8) return { name: "Steward", next: 11 };
  if (count >= 5) return { name: "Builder", next: 8 };
  if (count >= 2) return { name: "Apprentice", next: 5 };
  return { name: "Newcomer", next: 2 };
}

export default async function AchievementsPage() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("achievements")
    .select("key, earned_at")
    .eq("household_id", ctx.household.id);

  const earnedAt = new Map((data ?? []).map((a: { key: string; earned_at: string }) => [a.key, a.earned_at]));
  const earnedCount = earnedAt.size;
  const lvl = level(earnedCount);

  return (
    <div>
      <PageHeader
        title="Achievements"
        description="Milestones earned by building and maintaining your family's wealth."
      />

      <Card className="relative mb-6 overflow-hidden">
        <div className="gold-rule absolute inset-x-0 top-0 h-0.5" />
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="rounded-xl bg-gold/15 p-3 text-gold">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-semibold">{lvl.name}</p>
            <p className="text-sm text-muted-foreground">
              {earnedCount} of {ACHIEVEMENTS.length} achievements unlocked
            </p>
            <Progress
              value={Math.round((earnedCount / ACHIEVEMENTS.length) * 100)}
              indicatorClassName="bg-gold"
              className="mt-2 max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const earned = earnedAt.has(a.key);
          return (
            <Card key={a.key} className={earned ? "" : "opacity-60"}>
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={`rounded-lg p-2.5 ${
                    earned ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {earned ? <Icon className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{a.title}</p>
                    {earned && <Badge variant="success">Earned</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
