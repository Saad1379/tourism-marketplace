export type StaticBlogPost = {
  title: string
  metaTitle: string
  metaDescription: string
  slug: string
  datePublished: string
  schemaDescription: string
  paragraphs: string[]
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>
  cta: string
}

export const TIPPING_GUIDE_POST: StaticBlogPost = {
  title: "How Much Should You Tip a Walking Tour Guide in Paris?",
  metaTitle: "How Much to Tip a Tour Guide in Paris (2026 Guide) | Touricho",
  metaDescription:
    "Wondering how much to tip your walking tour guide in Paris? The honest answer from a Paris tour operator — with real numbers and local context.",
  slug: "how-much-to-tip-tour-guide-paris",
  datePublished: "2026-03-27",
  schemaDescription: "How much to tip a walking tour guide in Paris — real numbers from a Paris tour operator.",
  paragraphs: [
    "If you've just booked a free walking tour in Paris, you're probably wondering how much to tip your guide at the end. The short answer: €10–20 per person is the norm, and your guide will genuinely appreciate anything in that range.",
    "Here's everything you need to know before your tour.",
  ],
  sections: [
    {
      heading: "What's a Normal Tip for a Tour Guide in Paris?",
      paragraphs: [
        "Most guests on tip-based walking tours in Paris tip between €10 and €20 per person. On a 2-hour tour with a knowledgeable local guide, €15 is a solid benchmark. If the tour genuinely surprised you — great stories, hidden spots, personal recommendations — €20 is a meaningful way to say so.",
        "GuruWalk, one of the largest free tour platforms in Europe, suggests €15–50 per person. At Touricho, we suggest €10–20 because we want tipping to feel natural, not pressured. Our guides run small groups of maximum 10 guests, so a reasonable tip from everyone in the group adds up to a fair wage for a morning's work.",
      ],
    },
    {
      heading: "Do You Have to Tip on a Free Walking Tour?",
      paragraphs: [
        "Technically no — but practically, yes. Free walking tours are not free for the guide. They spend hours preparing routes, updating their knowledge, and showing up rain or shine. Tipping is how they earn their living. A tour where nobody tips is a tour that stops running.",
        "Think of it like a restaurant where the food is free but you tip the chef. The model only works if guests tip fairly.",
        "If you genuinely didn't enjoy the tour, you're not obligated to tip generously — that's the beauty of the model. But if you had a good time, €10–20 per person is the right range.",
      ],
    },
    {
      heading: "How to Tip in Paris — Cash or Card?",
      paragraphs: [
        "Most guides in Paris accept both cash and card. At Touricho, our guides accept tips by card through the platform, so you don't need to carry euros specifically for the tip. If you prefer cash, €10 and €20 notes are always appreciated.",
      ],
    },
    {
      heading: "What If You're on a Budget?",
      paragraphs: [
        "Even €5–10 is better than nothing and is always received warmly. If you're travelling on a tight budget, book a free tour, enjoy Paris properly, and tip what you genuinely can. No guide will make you feel bad for an honest tip.",
        "The tip-based model exists precisely so that cost is never a barrier to a great experience.",
      ],
    },
  ],
  cta: "Ready to book a free walking tour of Montmartre or the City Centre? Browse tours in Paris →",
}

export const STATIC_BLOG_POSTS: StaticBlogPost[] = [TIPPING_GUIDE_POST]
