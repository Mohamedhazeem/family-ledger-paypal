import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const features = [
  {
    title: "Consent-first plans",
    body: "Allocation categories are a shared plan, never a restriction on the money.",
  },
  {
    title: "AI-assisted extraction",
    body: "Turn a support note into a clear allocation plan with evidence-backed amounts.",
  },
  {
    title: "One unrestricted payout",
    body: "PayPal receives the full amount once. Plan edits never trigger extra payouts.",
  },
  {
    title: "Beneficiary voice",
    body: "Beneficiaries can accept, propose revisions, or decline to share — payment is independent.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-white to-white" />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Sandbox demo · synthetic data
                </span>
                <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Make the support plan clear
                  <span className="block text-indigo-600">before the money moves.</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg text-slate-600">
                  FamilyLedger 2.0 helps coordinators, beneficiaries, and sponsors agree on an
                  allocation plan — while the PayPal payout stays one unrestricted transfer.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/signup">
                    <Button size="lg">
                      Get started <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg">
                      Sign in
                    </Button>
                  </Link>
                </div>
                <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> PayPal sandbox payouts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Plan &amp; payment independent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No spending surveillance
                  </span>
                </div>
              </div>
              <div className="relative">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Disbursement FL-2048</span>
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">Sandbox</span>
                      </div>
                      <p className="mt-4 text-3xl font-bold">$500.00</p>
                      <p className="text-sm text-slate-300">Full unrestricted payout</p>
                    </div>
                    <div className="space-y-3 p-6">
                      {[
                        ["Education", "$200.00"],
                        ["Healthcare", "$150.00"],
                        ["Daily needs", "$150.00"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                          <span className="text-sm font-semibold text-slate-900">{value}</span>
                        </div>
                      ))}
                      <p className="pt-2 text-xs text-slate-500">
                        Categories are a shared plan stored in FamilyLedger — not PayPal restrictions.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">Built for trust on both sides</h2>
            <p className="mt-3 text-slate-600">Clear plans, voluntary consent, one payment.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title}>
                <CardContent>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how" className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                ["1", "Create disbursement", "Coordinator enters amount, beneficiary and support note."],
                ["2", "AI plan + invite", "AI proposes an allocation plan; beneficiary is invited."],
                ["3", "Acknowledge & pay", "Coordinator acknowledges the plan and sends one sandbox payout."],
              ].map(([n, t, b]) => (
                <li key={n} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {n}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{t}</h3>
                  <p className="mt-2 text-sm text-slate-600">{b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
