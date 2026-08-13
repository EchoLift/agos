import Link from "next/link";
import { notFound } from "next/navigation";
import HelpDesktopSidebar from "@/components/help/HelpDesktopSidebar";
import HelpHeader from "@/components/help/HelpHeader";
import HelpMobileNavigation from "@/components/help/HelpMobileNavigation";
import HelpSearch from "@/components/help/HelpSearch";
import MarkdownContent from "@/components/help/MarkdownContent";
import { getAllDocs, getDocBySlug, getDocsNavigation } from "@/lib/docs";

export const metadata = {
  title: "Help Center • AGENCIE",
  description: "Self-service product documentation for agency owners and creative teams.",
};

export function generateStaticParams() {
  return [{ slug: [] }, ...getAllDocs().map((article) => ({ slug: article.slug.split("/") }))];
}

export default async function HelpPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const articles = getAllDocs();
  const navigation = getDocsNavigation();
  const article = slug?.length ? getDocBySlug(slug) : null;

  if (slug?.length && !article) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <HelpHeader />
      </header>

      <main className="grid min-h-[calc(100vh-61px)] min-w-0 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_260px]">
        <aside className="border-b border-border bg-muted/30 p-3 sm:p-4 lg:hidden">
          <HelpSearch
            articles={articles.map(({ href, title, description, category, status }) => ({
              href,
              title,
              description,
              category,
              status,
            }))}
          />
          <HelpMobileNavigation navigation={navigation} activeSlug={article?.slug} />
        </aside>

        <HelpDesktopSidebar
          articles={articles.map(({ href, title, description, category, status }) => ({
            href,
            title,
            description,
            category,
            status,
          }))}
          navigation={navigation}
          activeSlug={article?.slug}
        />

        <section className="min-w-0 p-3 sm:p-4 lg:p-6">
          {article ? <ArticleView article={article} articles={articles} /> : <HelpOverview navigation={navigation} />}
        </section>

        <aside className="hidden border-l border-border bg-muted/30 p-4 lg:sticky lg:top-[61px] lg:block lg:h-[calc(100vh-61px)] lg:overflow-y-auto">
          {article ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">On This Page</div>
              <div className="mt-3 space-y-2">
                {article.headings.length ? (
                  article.headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={`block text-sm text-muted-foreground transition hover:text-primary ${heading.level === 3 ? "pl-3" : ""}`}
                    >
                      {heading.text}
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No sections.</p>
                )}
              </div>
            </>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function HelpOverview({ navigation }: { navigation: ReturnType<typeof getDocsNavigation> }) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Self-service docs</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">Run AGENCIE without a training call.</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
        Start with setup, then learn how clients, campaigns, gigs, workflow, and calendar connect inside one agency operating system.
      </p>
      <div className="mt-5 grid gap-3 md:mt-8 md:grid-cols-2 md:gap-4">
        {navigation.map((section) => (
          <div key={section.category} className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <h2 className="text-lg font-semibold text-foreground">{section.category}</h2>
            <div className="mt-3 space-y-2">
              {section.articles.slice(0, 5).map((article) => (
                <Link key={article.slug} href={article.href} className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  {article.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticleView({ article, articles }: { article: NonNullable<ReturnType<typeof getDocBySlug>>; articles: ReturnType<typeof getAllDocs> }) {
  const index = articles.findIndex((item) => item.slug === article.slug);
  const previous = index > 0 ? articles[index - 1] : null;
  const next = index < articles.length - 1 ? articles[index + 1] : null;

  return (
    <article className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-4 shadow-lg shadow-black/10 sm:p-5 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/help" className="text-sm text-muted-foreground transition hover:text-primary">
              Help
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{article.category}</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{article.title}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{article.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {article.status.replace("_", " ")}
          </span>
          {article.roles.length ? <span className="text-xs text-muted-foreground">For {article.roles.join(", ")}</span> : null}
        </div>
      </div>

      <div className="my-8 h-px bg-border" />
      <MarkdownContent markdown={article.body} />

      <div className="mt-10 grid gap-3 border-t border-border pt-5 md:grid-cols-2">
        {previous ? (
          <Link href={previous.href} className="rounded-2xl border border-border p-4 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <span className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">Previous</span>
            {previous.title}
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link href={next.href} className="rounded-2xl border border-border p-4 text-right text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <span className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">Next</span>
            {next.title}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
