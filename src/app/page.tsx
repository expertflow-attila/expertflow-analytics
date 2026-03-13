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
  getTrafficSourcesByPage,
  getDevicesByPage,
  getBrowsersByPage,
  getEventsByPage,
} from "@/lib/posthog";
import { Dashboard } from "@/components/Dashboard";

export const revalidate = 300;

export default async function Home() {
  const [overview, pages, daily, sources, devices, browsers, cities, topPages, events, sourcesByPage, devicesByPage, browsersByPage, eventsByPage] = await Promise.all([
    getOverviewStats(30),
    getPageStats(30),
    getDailyTraffic(30),
    getTrafficSources(30),
    getDeviceBreakdown(30),
    getBrowserBreakdown(30),
    getTopCities(30),
    getTopPages(30),
    getCustomEvents(30),
    getTrafficSourcesByPage(30),
    getDevicesByPage(30),
    getBrowsersByPage(30),
    getEventsByPage(30),
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
      sourcesByPage={sourcesByPage}
      devicesByPage={devicesByPage}
      browsersByPage={browsersByPage}
      eventsByPage={eventsByPage}
    />
  );
}
