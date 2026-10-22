import type { RunSummary } from "@clockwyrks/backend-api/snapshot";
import type { RunRecord } from "@clockwyrks/run-record";
import {
  GalleryApp,
  GalleryDataProvider,
  RunsRuntimeProvider,
  runSummaryPage,
  type GalleryDataInput,
  type RunDetail,
  type RunQuery,
  type RunQueryResult,
} from "@clockwyrks/ui/app";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

/**
 * What the Runs page arrives at in a real browser.
 *
 * The run log lays each row out as a grid at desktop widths and as a stacked
 * card below the small breakpoint, and it is the browser's hit-testing that
 * decides which element a tap on that card reaches. jsdom lays nothing out, so
 * its click lands on whatever element it is dispatched to; the claims here are
 * about where a pointer actually lands, which only an engine at a real width
 * can say. The suite runs in each engine `vite.config.ts` names, at each width
 * it names.
 *
 * The page is opened the way the console opens it: the routed gallery app,
 * with a data source that answers the page's summary query from a fixed cabinet
 * and can execute nothing. The Runs page is the selectable run log's home, and
 * the same log serves the Unpublished and gg Sessions pages, so a tap that
 * opens a run here opens one there.
 */

/** A run summary carrying the fields the run log and the query read. */
function summary(id: string, slug: string, startedAt: string): RunSummary {
  return {
    id,
    publishedAt: startedAt,
    startedAt,
    finishedAt: startedAt,
    subject: {
      testCaseSlug: slug,
      testCaseVersion: "1.0.0",
      testType: "end-to-end",
      variant: "base",
      harnessSlug: "claude",
      harnessVersion: "1",
      modelId: "anthropic/claude",
      ggPreset: null,
    },
    metrics: {
      runTimeSeconds: 60,
      tokens: {
        uncachedInput: 100,
        cachedInput: null,
        output: null,
        reasoning: null,
      },
      cost: { comparable: 1, actual: 1 },
    },
    state: "completed",
    rating: null,
  } as unknown as RunSummary;
}

const RUNS = [
  summary("r-alpha", "alpha", "2026-01-02T00:00:00Z"),
  summary("r-beta", "beta", "2026-01-01T00:00:00Z"),
];

/**
 * The record a run's page reads, carrying the fields its header and landing tab
 * read: the subject the title is drawn from, a settled status, validation with
 * no proof media, and no published outputs.
 */
function record(run: RunSummary): RunRecord {
  return {
    id: run.id,
    subject: { ...run.subject, engineSlug: "none" },
    status: { state: "completed", detail: null },
    validation: { loaded: true, proofs: [] },
    links: { sourceRepo: null, playableBuild: null },
  } as unknown as RunRecord;
}

/** The cabinet the page lists: two published runs, nothing executing. */
function galleryValue(): GalleryDataInput {
  return {
    producedSummaries: [],
    localIds: new Set(),
    writeups: {},
    reviews: {},
    runsLoading: false,
    queryRunSummaries: (query: RunQuery): Promise<RunQueryResult> =>
      Promise.resolve(runSummaryPage(RUNS, { ...query, state: "published" })),
    readRun: (runId: string): Promise<RunDetail | null> => {
      const run = RUNS.find((r) => r.id === runId);
      return Promise.resolve(
        run
          ? {
              record: record(run),
              reviews: [],
              validatorRated: false,
              rating: null,
              aesthetic: null,
              published: true,
              showcase: null,
            }
          : null,
      );
    },
    testCases: [
      { slug: "alpha", name: "Alpha", versions: ["1.0.0"] },
      { slug: "beta", name: "Beta", versions: ["1.0.0"] },
    ],
    testCasesStatus: "ready",
    models: [],
    modelsStatus: "ready",
    canExecute: false,
  } as unknown as GalleryDataInput;
}

/**
 * How long a test's first row is given to arrive.
 *
 * The rows are answered from a fixed cabinet the moment the page asks, so what
 * this budgets is the page's own render. The suite's first render is the costly
 * one: in a cold WebKit on a pipeline agent, where six instances share the
 * agent's cores, it loads and compiles every gallery module the page reaches
 * and has taken close to thirty seconds, while the same render a test later
 * takes two. That cold render is done once, before the tests, by `warmUp`, so
 * this budgets a warm render with a wide margin rather than racing the cold one.
 */
const ARRIVAL_BUDGET = 30_000;

/**
 * The time the warm-up is given: the cold first render, however long the agent
 * takes to load the gallery's modules. It bounds a hung page, not a slow one.
 */
const WARM_UP_TIMEOUT = 180_000;

/** The time a test is given, which holds the arrival budget and the click. */
const TEST_TIMEOUT = 45_000;

/** Where the router is, readable from the page, so a navigation is observable. */
function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

/**
 * Renders the Runs page the way the console opens it, into `host` when one is
 * given and into a container the runner's cleanup removes otherwise.
 */
function renderRunsPage(host?: HTMLElement) {
  return render(
    <GalleryDataProvider value={galleryValue()}>
      <RunsRuntimeProvider>
        <MemoryRouter initialEntries={["/runs"]}>
          <GalleryApp />
          <LocationProbe />
        </MemoryRouter>
      </RunsRuntimeProvider>
    </GalleryDataProvider>,
    host === undefined ? undefined : { container: host },
  );
}

/**
 * Opens the Runs page, waits for its rows to arrive, and answers the first row's
 * title: the test case's name, which the row's link is named after, and which
 * the filter bar's test-case facet also lists, so it is found through the link.
 */
async function openRunsPage(): Promise<HTMLElement> {
  renderRunsPage();
  const row = await screen.findByRole(
    "link",
    { name: /Alpha/ },
    { timeout: ARRIVAL_BUDGET },
  );
  return within(row).getByText("Alpha");
}

/**
 * Opens the Runs page once and takes it down again, so the engine has loaded
 * and compiled the gallery's modules before any test opens the page and the
 * cold first render is not charged to whichever test happens to run first.
 *
 * The page is rendered into a host of its own and taken out of the document
 * here rather than left to the runner's cleanup, which runs after each test and
 * not after this hook: left in, the first test would find two pages.
 */
async function warmUp(): Promise<void> {
  const host = document.createElement("div");
  document.body.append(host);
  const { unmount } = renderRunsPage(host);
  await screen.findByRole(
    "link",
    { name: /Alpha/ },
    { timeout: WARM_UP_TIMEOUT },
  );
  unmount();
  host.remove();
  localStorage.clear();
  sessionStorage.clear();
}

/**
 * The element a pointer at the centre of `element` lands on, once the page is
 * scrolled to show it: a pointer reaches nothing below the fold.
 */
function underPointer(element: Element): Element | null {
  element.scrollIntoView({ block: "center" });
  const box = element.getBoundingClientRect();
  return document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
  );
}

// The gallery keeps the tab's in-app history in sessionStorage for its back
// controls, so each test starts from a tab with nothing behind it.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("the Runs page in a browser", { timeout: TEST_TIMEOUT }, () => {
  beforeAll(warmUp, WARM_UP_TIMEOUT);

  it("puts a run's title under the pointer, not the selection control", async () => {
    const title = await openRunsPage();

    // The log's rows are selectable, and the selection control is a checkbox
    // whose hit area bleeds over the row's padding on a desktop. At a phone
    // width the checkbox is hidden; what must not remain is a hit area that
    // covers the card and takes every tap meant for the row.
    const hit = underPointer(title);
    expect(hit).not.toHaveAttribute("role", "checkbox");
    expect(hit).toBe(title);
  });

  it("opens the run a tap on its title lands on", async () => {
    const title = await openRunsPage();
    expect(screen.getByTestId("location")).toHaveTextContent("/runs");

    // A real pointer click, so the engine decides what it lands on: a click
    // dispatched straight to the title would pass however the log was laid out.
    await userEvent.click(title);

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/runs/r-alpha");
    });
  });

  it("returns to the Runs page from the run's back chevron", async () => {
    const title = await openRunsPage();
    await userEvent.click(title);
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/runs/r-alpha");
    });

    // The run was opened from the list, so its chevron returns through history
    // to the list rather than naming its fallback.
    const back = await screen.findByRole(
      "link",
      { name: "Back" },
      { timeout: ARRIVAL_BUDGET },
    );
    await userEvent.click(back);

    await waitFor(() => {
      const location = screen.getByTestId("location");
      expect(location).toHaveTextContent("/runs");
      expect(location).not.toHaveTextContent("r-alpha");
    });
    expect(
      await screen.findByRole(
        "link",
        { name: /Alpha/ },
        { timeout: ARRIVAL_BUDGET },
      ),
    ).toBeInTheDocument();
  });
});
