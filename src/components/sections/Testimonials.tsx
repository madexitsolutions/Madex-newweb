import { testimonials } from "@/content/site";
import { getGoogleReviews } from "@/lib/server/google-reviews";
import { TestimonialsSlider, type Review } from "./TestimonialsSlider";

/**
 * Customer reviews: live 4–5 star reviews from Google when the Places API is
 * configured, otherwise the curated testimonials from the old website.
 */
export async function Testimonials() {
  const google = await getGoogleReviews();
  if (google) {
    const items: Review[] = google.reviews.map((r) => ({ quote: r.text, name: r.author, rating: r.rating, when: r.when, url: r.authorUrl }));
    return <TestimonialsSlider items={items} source={{ rating: google.rating, count: google.count, url: google.mapsUrl }} />;
  }
  return <TestimonialsSlider items={testimonials} />;
}
