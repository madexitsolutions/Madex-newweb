import { afterEach, describe, expect, it, vi } from "vitest";
import { getGoogleReviews } from "@/lib/server/google-reviews";

const review = (rating: number, text: string, name = `Kunde ${rating}`) => ({
  rating,
  relativePublishTimeDescription: "vor 2 Monaten",
  publishTime: `2026-0${rating}-01T00:00:00Z`,
  originalText: { text },
  authorAttribution: { displayName: name, uri: `https://maps.google.com/u/${rating}` },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google-Bewertungen", () => {
  it("ist ohne API-Schlüssel deaktiviert", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getGoogleReviews()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("zeigt nur 4- und 5-Sterne-Bewertungen mit Text", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "key");
    vi.stubEnv("GOOGLE_PLACE_ID", "place");
    const fetchMock = vi.fn(async () =>
      Response.json({
        rating: 4.6,
        userRatingCount: 31,
        googleMapsUri: "https://maps.google.com/?cid=1",
        reviews: [review(5, "Top Betreuung"), review(3, "Geht so"), review(4, "Gut"), review(1, "Schlecht"), review(5, "  ")],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await getGoogleReviews();
    expect(res?.rating).toBe(4.6);
    expect(res?.count).toBe(31);
    expect(res?.reviews.map((r) => r.rating)).toEqual([5, 4]);
    expect(res?.reviews[0]).toMatchObject({ author: "Kunde 5", text: "Top Betreuung", authorUrl: "https://maps.google.com/u/5" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("places.googleapis.com/v1/places/place");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("reviews");
  });

  it("fällt bei Fehlern auf null zurück", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "key");
    vi.stubEnv("GOOGLE_PLACE_ID", "place");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 403 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getGoogleReviews()).toBeNull();
  });
});
