import {
  getOverviewStats,
  getPageStats,
  getDailyTraffic,
  getTrafficSources,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getTopCities,
  getTopPages,
  getCustomEvents,
} from "@/lib/posthog";
import { Dashboard } from "@/components/Dashboard";

export const revalidate = 300;

export default async function Home() {
  const [overview, pages, daily, sources, devices, browsers, cities, topPages, events] = await Promise.all([
    getOverviewStats(30),
    getPageStats(30),
    getDailyTraffic(30),
    getTrafficSources(30),
    getDeviceBreakdown(30),
    getBrowserBreakdown(30),
    getTopCities(30),
    getTopPages(30),
    getCustomEvents(30),
  ]);

  return (
    <Dashboard
      overview={overview}
      pages={pages}
      daily={daily}
      sources={sources}
      devices={devices}
      browsers={browsers}
      cities={cities}
      topPages={topPages}
      events={events}
    />
  );
}
