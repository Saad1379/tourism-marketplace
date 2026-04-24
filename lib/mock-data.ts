export const featuredTours = [
  {
    id: "1",
    title: "Historical Paris Walking Tour - Notre Dame to Louvre",
    city: "Paris, France",
    image: "/paris-eiffel-tower-historic-streets.jpg",
    rating: 4.9,
    reviewCount: 2847,
    duration: "2.5 hours",
    maxGroupSize: 15,
    guideName: "Marie Laurent",
    guideAvatar: "/french-woman-guide-portrait.jpg",
    languages: ["English", "French", "Spanish"],
    isPremium: true,
  },
  {
    id: "2",
    title: "Ancient Rome: Colosseum & Roman Forum Exploration",
    city: "Rome, Italy",
    image: "/rome-colosseum-ancient-ruins.jpg",
    rating: 4.8,
    reviewCount: 3156,
    duration: "3 hours",
    maxGroupSize: 20,
    guideName: "Marco Rossi",
    guideAvatar: "/italian-man-guide-portrait.jpg",
    languages: ["English", "Italian"],
    isPremium: true,
  },
  {
    id: "3",
    title: "Gothic Quarter & La Rambla Barcelona Tour",
    city: "Barcelona, Spain",
    image: "/barcelona-gothic-quarter-architecture.jpg",
    rating: 4.9,
    reviewCount: 1923,
    duration: "2 hours",
    maxGroupSize: 12,
    guideName: "Sofia Garcia",
    guideAvatar: "/spanish-woman-guide-portrait.jpg",
    languages: ["English", "Spanish", "Catalan"],
    isPremium: false,
  },
  {
    id: "4",
    title: "Royal London: Westminster & Buckingham Palace",
    city: "London, UK",
    image: "/london-big-ben-westminster.jpg",
    rating: 4.7,
    reviewCount: 2341,
    duration: "2.5 hours",
    maxGroupSize: 18,
    guideName: "James Wilson",
    guideAvatar: "/british-man-guide-portrait.jpg",
    languages: ["English"],
    isPremium: false,
  },
  {
    id: "5",
    title: "Amsterdam Canal District & Hidden Gems",
    city: "Amsterdam, Netherlands",
    image: "/amsterdam-canals-historic-houses.jpg",
    rating: 4.8,
    reviewCount: 1567,
    duration: "2 hours",
    maxGroupSize: 15,
    guideName: "Anna de Vries",
    guideAvatar: "/dutch-woman-guide-portrait.jpg",
    languages: ["English", "Dutch", "German"],
    isPremium: true,
  },
  {
    id: "6",
    title: "Prague Castle & Old Town Square Discovery",
    city: "Prague, Czech Republic",
    image: "/prague-castle-old-town-square.jpg",
    rating: 4.9,
    reviewCount: 1289,
    duration: "3 hours",
    maxGroupSize: 16,
    guideName: "Jan Novak",
    guideAvatar: "/czech-man-guide-portrait.jpg",
    languages: ["English", "Czech", "German"],
    isPremium: false,
  },
]

export const featuredCities = [
  {
    name: "Paris",
    country: "France",
    image: "/paris-cityscape-eiffel-tower.jpg",
    tourCount: 156,
  },
  {
    name: "Rome",
    country: "Italy",
    image: "/rome-cityscape-colosseum.jpg",
    tourCount: 142,
  },
  {
    name: "Barcelona",
    country: "Spain",
    image: "/barcelona-cityscape-sagrada-familia.jpg",
    tourCount: 98,
  },
  {
    name: "London",
    country: "UK",
    image: "/london-cityscape-big-ben.jpg",
    tourCount: 124,
  },
  {
    name: "Lisbon",
    country: "Portugal",
    image: "/lisbon.jpg",
    tourCount: 45,
  },
  {
    name: "Amsterdam",
    country: "Netherlands",
    image: "/placeholder.svg?height=500&width=400",
    tourCount: 67,
  },
]

export const latestReviews = [
  {
    id: "1",
    authorName: "Sarah M.",
    authorAvatar: "/placeholder.svg?height=100&width=100",
    rating: 5,
    date: "2 days ago",
    content:
      "Absolutely incredible experience! Marie was so knowledgeable about Parisian history and took us to hidden spots we never would have found on our own. The tour felt personal and intimate despite having a group. Highly recommend!",
    tourTitle: "Historical Paris Walking Tour",
    city: "Paris",
  },
  {
    id: "2",
    authorName: "Michael R.",
    authorAvatar: "/placeholder.svg?height=100&width=100",
    rating: 5,
    date: "5 days ago",
    content:
      "Marco brought ancient Rome to life! His storytelling made you feel like you were walking through the city 2000 years ago. The tour was well-paced and covered so much ground. Don't miss this one!",
    tourTitle: "Ancient Rome: Colosseum & Roman Forum",
    city: "Rome",
  },
  {
    id: "3",
    authorName: "Emma L.",
    authorAvatar: "/placeholder.svg?height=100&width=100",
    rating: 5,
    date: "1 week ago",
    content:
      "Sofia was amazing! She shared local stories and secrets about Barcelona that you won't find in any guidebook. The Gothic Quarter is magical and she made it even more special. Worth every minute!",
    tourTitle: "Gothic Quarter & La Rambla Tour",
    city: "Barcelona",
  },
]

export const stats = [
  { value: "50,000+", label: "Happy Travelers" },
  { value: "2,500+", label: "Local Guides" },
  { value: "35+", label: "cities across Europe" },
  { value: "4.8", label: "Average Rating" },
]

export const allTours = [
  ...featuredTours,
  {
    id: "7",
    title: "Berlin Wall & Cold War History Tour",
    city: "Berlin, Germany",
    image: "/berlin-wall-memorial-graffiti.jpg",
    rating: 4.8,
    reviewCount: 1456,
    duration: "3 hours",
    maxGroupSize: 20,
    guideName: "Hans Mueller",
    guideAvatar: "/german-man-guide-portrait.jpg",
    languages: ["English", "German"],
    isPremium: false,
  },
  {
    id: "8",
    title: "Lisbon: Alfama & Fado Music District",
    city: "Lisbon, Portugal",
    image: "/lisbon-alfama-colorful-streets.jpg",
    rating: 4.9,
    reviewCount: 892,
    duration: "2.5 hours",
    maxGroupSize: 14,
    guideName: "Ana Santos",
    guideAvatar: "/portuguese-woman-guide-portrait.jpg",
    languages: ["English", "Portuguese", "Spanish"],
    isPremium: true,
  },
  {
    id: "9",
    title: "Vienna Imperial Palace & Coffee House Tour",
    city: "Vienna, Austria",
    image: "/vienna-palace-baroque-architecture.jpg",
    rating: 4.7,
    reviewCount: 678,
    duration: "2.5 hours",
    maxGroupSize: 15,
    guideName: "Franz Weber",
    guideAvatar: "/austrian-man-guide-portrait.jpg",
    languages: ["English", "German"],
    isPremium: false,
  },
  {
    id: "10",
    title: "Athens: Acropolis & Ancient Agora Walk",
    city: "Athens, Greece",
    image: "/athens-acropolis-parthenon-view.jpg",
    rating: 4.9,
    reviewCount: 1234,
    duration: "3 hours",
    maxGroupSize: 18,
    guideName: "Elena Papadopoulos",
    guideAvatar: "/greek-woman-guide-portrait.jpg",
    languages: ["English", "Greek"],
    isPremium: true,
  },
  {
    id: "11",
    title: "Dublin Literary & Pub Heritage Tour",
    city: "Dublin, Ireland",
    image: "/dublin-temple-bar-colorful-pubs.jpg",
    rating: 4.8,
    reviewCount: 956,
    duration: "2.5 hours",
    maxGroupSize: 16,
    guideName: "Patrick O'Brien",
    guideAvatar: "/irish-man-guide-portrait.jpg",
    languages: ["English"],
    isPremium: false,
  },
  {
    id: "12",
    title: "Florence Renaissance Art & History",
    city: "Florence, Italy",
    image: "/florence-duomo-renaissance-architecture.jpg",
    rating: 4.9,
    reviewCount: 1567,
    duration: "2.5 hours",
    maxGroupSize: 15,
    guideName: "Giulia Bianchi",
    guideAvatar: "/italian-woman-guide-portrait.jpg",
    languages: ["English", "Italian", "French"],
    isPremium: true,
  },
]

export const tourDetails: Record<
  string,
  {
    id: string
    title: string
    city: string
    country: string
    images: string[]
    rating: number
    reviewCount: number
    duration: string
    maxGroupSize: number
    guideName: string
    guideAvatar: string
    guideBio: string
    guideRating: number
    guideTourCount: number
    languages: string[]
    isPremium: boolean
    description: string
    highlights: string[]
    included: string[]
    meetingPoint: string
    meetingPointDetails: string
    schedule: { day: string; times: string[] }[]
    reviews: ReviewCardProps[]
  }
> = {
  "1": {
    id: "1",
    title: "Historical Paris Walking Tour - Notre Dame to Louvre",
    city: "Paris",
    country: "France",
    images: [
      "/paris-eiffel-tower-historic-streets.jpg",
      "/paris-cityscape-eiffel-tower.jpg",
      "/paris-notre-dame-cathedral.jpg",
    ],
    rating: 4.9,
    reviewCount: 2847,
    duration: "2.5 hours",
    maxGroupSize: 15,
    guideName: "Marie Laurent",
    guideAvatar: "/french-woman-guide-portrait.jpg",
    guideBio:
      "Born and raised Parisian with 8 years of guiding experience. Art history graduate from the Sorbonne. I love sharing the hidden stories of my beautiful city!",
    guideRating: 4.9,
    guideTourCount: 1240,
    languages: ["English", "French", "Spanish"],
    isPremium: true,
    description:
      "Join me on an unforgettable journey through the heart of Paris! We'll explore the rich history and stunning architecture from Notre Dame Cathedral to the world-famous Louvre Museum. Along the way, discover hidden courtyards, charming cafés, and stories that only a local can share. This tour is perfect for first-time visitors and returning travelers alike who want to experience the authentic Parisian atmosphere.",
    highlights: [
      "Visit the iconic Notre Dame Cathedral and learn about its history and restoration",
      "Walk along the Seine River with stunning views of Paris landmarks",
      "Explore the charming Île de la Cité, the birthplace of Paris",
      "Discover hidden passages and courtyards unknown to most tourists",
      "Learn about French Revolution history at key historical sites",
      "End at the magnificent Louvre Museum pyramid",
    ],
    included: [
      "Professional English-speaking guide",
      "Small group experience (max 15 people)",
      "Historical insights and local stories",
      "Photo opportunities at the best spots",
      "Restaurant and café recommendations",
    ],
    meetingPoint: "Saint-Michel Fountain",
    meetingPointDetails:
      "Meet at the Saint-Michel Fountain in Place Saint-Michel. Look for the guide holding a red umbrella. The fountain is easily accessible by Metro (Line 4, Saint-Michel station).",
    schedule: [
      { day: "Monday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Tuesday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Wednesday", times: ["10:00 AM"] },
      { day: "Thursday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Friday", times: ["10:00 AM", "2:30 PM", "6:00 PM"] },
      { day: "Saturday", times: ["10:00 AM", "2:30 PM", "6:00 PM"] },
      { day: "Sunday", times: ["10:00 AM", "2:30 PM"] },
    ],
    reviews: [
      {
        id: "r1",
        authorName: "Sarah M.",
        authorAvatar: "/placeholder.svg?height=100&width=100",
        rating: 5,
        date: "2 days ago",
        content:
          "Absolutely incredible experience! Marie was so knowledgeable about Parisian history and took us to hidden spots we never would have found on our own. The tour felt personal and intimate despite having a group. Highly recommend!",
        tourTitle: "Historical Paris Walking Tour",
        city: "Paris",
      },
      {
        id: "r2",
        authorName: "John D.",
        authorAvatar: "/placeholder.svg?height=100&width=100",
        rating: 5,
        date: "1 week ago",
        content:
          "Best walking tour we've ever taken! Marie's passion for Paris is contagious. She answered all our questions and gave great restaurant recommendations. Will definitely book another tour with her!",
        tourTitle: "Historical Paris Walking Tour",
        city: "Paris",
      },
      {
        id: "r3",
        authorName: "Lisa K.",
        authorAvatar: "/placeholder.svg?height=100&width=100",
        rating: 5,
        date: "2 weeks ago",
        content:
          "Marie made history come alive! Her storytelling is fantastic and she really knows how to engage the group. Perfect pace and duration. A must-do in Paris!",
        tourTitle: "Historical Paris Walking Tour",
        city: "Paris",
      },
    ],
  },
}

// Helper to get tour detail or generate placeholder
export function getTourDetail(id: string) {
  if (tourDetails[id]) {
    return tourDetails[id]
  }

  const tour = allTours.find((t) => t.id === id)
  if (!tour) return null

  return {
    ...tour,
    country: tour.city.split(", ")[1] || "",
    city: tour.city.split(", ")[0],
    images: [tour.image, tour.image, tour.image],
    guideBio:
      "Passionate local guide with years of experience showing visitors the hidden gems of this beautiful city.",
    guideRating: tour.rating,
    guideTourCount: Math.floor(Math.random() * 500) + 100,
    description: `Join this amazing walking tour through ${tour.city}. Your expert guide will take you on a journey through history, culture, and local life. Perfect for travelers who want to discover the authentic side of the city beyond the typical tourist spots.`,
    highlights: [
      "Discover iconic landmarks and hidden gems",
      "Learn fascinating historical stories from a local expert",
      "Explore charming neighborhoods off the beaten path",
      "Get insider tips on the best local restaurants and cafés",
      "Enjoy a small group experience with personalized attention",
    ],
    included: [
      "Professional English-speaking guide",
      "Small group experience",
      "Historical insights and local stories",
      "Photo opportunities",
      "Restaurant recommendations",
    ],
    meetingPoint: "City Center Main Square",
    meetingPointDetails: "Meet at the main square in the city center. Look for the guide holding a red umbrella.",
    schedule: [
      { day: "Monday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Wednesday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Friday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Saturday", times: ["10:00 AM", "2:30 PM"] },
      { day: "Sunday", times: ["10:00 AM"] },
    ],
    reviews: latestReviews.map((r, i) => ({ ...r, id: `r${i}` })),
  }
}

export type ReviewCardProps = {
  id: string
  authorName: string
  authorAvatar: string
  rating: number
  date: string
  content: string
  tourTitle: string
  city: string
}

export type AttendanceStatus = "pending" | "confirmed" | "show" | "no-show"

export interface BookingParticipant {
  id: string
  name: string
  email: string
  avatar: string
  participants: number
  attendanceStatus: AttendanceStatus
  touristConfirmed: boolean
  bookedAt: string
}

export interface TouristBooking {
  id: string
  tour: string
  tourId: string
  guide: string
  guideAvatar: string
  date: string
  time: string
  city: string
  country: string
  image: string
  duration: string
  meetingPoint: string
  status: "upcoming" | "completed" | "cancelled"
  attendanceStatus: AttendanceStatus
  touristConfirmed: boolean
  canConfirmAttendance: boolean
  participants: number
  totalPaid?: number
  rating?: number
  reviewed: boolean
}

// Tourist notifications
export interface TouristNotification {
  id: string
  type: "booking" | "reminder" | "review" | "message" | "attendance"
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

export const touristNotifications: TouristNotification[] = [
  {
    id: "notif-1",
    type: "reminder",
    title: "Tour Tomorrow",
    message: "Your Vienna Imperial Palace Tour is tomorrow at 10:00 AM",
    timestamp: "1 hour ago",
    read: false,
    actionUrl: "/bookings",
  },
  {
    id: "notif-2",
    type: "attendance",
    title: "Confirm Your Attendance",
    message: "Did you attend the Historic Paris Walking Tour? Confirm to help the guide.",
    timestamp: "2 days ago",
    read: false,
    actionUrl: "/bookings",
  },
  {
    id: "notif-3",
    type: "review",
    title: "Leave a Review",
    message: "How was your Berlin Wall Memorial Tour? Share your experience!",
    timestamp: "3 days ago",
    read: true,
    actionUrl: "/bookings",
  },
  {
    id: "notif-4",
    type: "message",
    title: "New Message from Marie Dubois",
    message: "Hi! Looking forward to seeing you on the tour...",
    timestamp: "5 days ago",
    read: true,
    actionUrl: "/dashboard/messages",
  },
]

// Guide booking management data with check-in feature
export const guideBookingParticipants: Record<string, BookingParticipant[]> = {
  "booking-1": [
    {
      id: "p1",
      name: "Sarah Mitchell",
      email: "sarah.m@email.com",
      avatar: "/smiling-woman-portrait.png",
      participants: 2,
      attendanceStatus: "pending",
      touristConfirmed: false,
      bookedAt: "Dec 8, 2024",
    },
    {
      id: "p2",
      name: "James Chen",
      email: "james.chen@email.com",
      avatar: "/casual-man-portrait.png",
      participants: 1,
      attendanceStatus: "pending",
      touristConfirmed: false,
      bookedAt: "Dec 9, 2024",
    },
    {
      id: "p3",
      name: "Emma Rodriguez",
      email: "emma.r@email.com",
      avatar: "/french-woman-guide-portrait.jpg",
      participants: 3,
      attendanceStatus: "pending",
      touristConfirmed: false,
      bookedAt: "Dec 10, 2024",
    },
  ],
  "booking-2": [
    {
      id: "p4",
      name: "Michael Brown",
      email: "m.brown@email.com",
      avatar: "/german-man-guide-portrait.jpg",
      participants: 2,
      attendanceStatus: "show",
      touristConfirmed: true,
      bookedAt: "Dec 5, 2024",
    },
    {
      id: "p5",
      name: "Lisa Wang",
      email: "lisa.w@email.com",
      avatar: "/portuguese-woman-guide-portrait.jpg",
      participants: 1,
      attendanceStatus: "no-show",
      touristConfirmed: false,
      bookedAt: "Dec 6, 2024",
    },
  ],
}

// Enhanced tourist bookings with attendance confirmation
export const enhancedTouristBookings: TouristBooking[] = [
  {
    id: "tb-1",
    tour: "Vienna Imperial Palace Tour",
    tourId: "9",
    guide: "Klaus Weber",
    guideAvatar: "/casual-man-portrait.png",
    date: "Jan 5, 2025",
    time: "10:00 AM",
    city: "Vienna",
    country: "Austria",
    image: "/vienna-palace-baroque-architecture.jpg",
    duration: "2.5 hours",
    meetingPoint: "In front of Hofburg Palace main entrance",
    status: "upcoming",
    attendanceStatus: "pending",
    touristConfirmed: false,
    canConfirmAttendance: false,
    participants: 2,
    reviewed: false,
  },
  {
    id: "tb-2",
    tour: "Prague Old Town & Castle Walk",
    tourId: "6",
    guide: "Petra Novakova",
    guideAvatar: "/czech-woman-portrait.jpg",
    date: "Jan 12, 2025",
    time: "2:00 PM",
    city: "Prague",
    country: "Czech Republic",
    image: "/prague-old-town-square.png",
    duration: "3 hours",
    meetingPoint: "Astronomical Clock, Old Town Square",
    status: "upcoming",
    attendanceStatus: "pending",
    touristConfirmed: false,
    canConfirmAttendance: false,
    participants: 1,
    reviewed: false,
  },
  {
    id: "tb-3",
    tour: "Historic Paris Walking Tour",
    tourId: "1",
    guide: "Marie Dubois",
    guideAvatar: "/french-woman-guide-portrait.jpg",
    date: "Dec 15, 2024",
    time: "10:00 AM",
    city: "Paris",
    country: "France",
    image: "/paris-eiffel-tower.png",
    duration: "2 hours",
    meetingPoint: "Saint-Michel Fountain",
    status: "completed",
    attendanceStatus: "show",
    touristConfirmed: true,
    canConfirmAttendance: false,
    participants: 2,
    totalPaid: 20,
    rating: 5,
    reviewed: true,
  },
  {
    id: "tb-4",
    tour: "Berlin Wall Memorial Tour",
    tourId: "7",
    guide: "Thomas Schmidt",
    guideAvatar: "/german-man-guide-portrait.jpg",
    date: "Dec 10, 2024",
    time: "2:00 PM",
    city: "Berlin",
    country: "Germany",
    image: "/berlin-wall-memorial-graffiti.jpg",
    duration: "2.5 hours",
    meetingPoint: "Bernauer Straße Memorial",
    status: "completed",
    attendanceStatus: "pending",
    touristConfirmed: false,
    canConfirmAttendance: true, // Tour completed, waiting for tourist confirmation
    participants: 1,
    totalPaid: 15,
    reviewed: false,
  },
  {
    id: "tb-5",
    tour: "Lisbon Alfama District Tour",
    tourId: "8",
    guide: "Ana Santos",
    guideAvatar: "/portuguese-woman-guide-portrait.jpg",
    date: "Oct 10, 2024",
    time: "11:00 AM",
    city: "Lisbon",
    country: "Portugal",
    image: "/lisbon-alfama-colorful-streets.jpg",
    duration: "2 hours",
    meetingPoint: "Sé Cathedral entrance",
    status: "completed",
    attendanceStatus: "show",
    touristConfirmed: true,
    canConfirmAttendance: false,
    participants: 2,
    totalPaid: 25,
    rating: 4,
    reviewed: false,
  },
]

// Wishlist items for tourists
export interface WishlistItem {
  id: string
  tourId: string
  title: string
  city: string
  country: string
  image: string
  rating: number
  reviewCount: number
  guideName: string
  guideAvatar: string
  addedAt: string
}

export const touristWishlist: WishlistItem[] = [
  {
    id: "wl-1",
    tourId: "2",
    title: "Ancient Rome: Colosseum & Roman Forum",
    city: "Rome",
    country: "Italy",
    image: "/rome-colosseum-ancient-ruins.jpg",
    rating: 4.8,
    reviewCount: 3156,
    guideName: "Marco Rossi",
    guideAvatar: "/italian-man-guide-portrait.jpg",
    addedAt: "Dec 5, 2024",
  },
  {
    id: "wl-2",
    tourId: "3",
    title: "Gothic Quarter & La Rambla Barcelona Tour",
    city: "Barcelona",
    country: "Spain",
    image: "/barcelona-gothic-quarter-streets.jpg",
    rating: 4.9,
    reviewCount: 1923,
    guideName: "Sofia Garcia",
    guideAvatar: "/spanish-woman-guide-portrait.jpg",
    addedAt: "Nov 28, 2024",
  },
  {
    id: "wl-3",
    tourId: "5",
    title: "Amsterdam Canal District & Hidden Gems",
    city: "Amsterdam",
    country: "Netherlands",
    image: "/amsterdam-canal-houses-boats.jpg",
    rating: 4.8,
    reviewCount: 1567,
    guideName: "Anna de Vries",
    guideAvatar: "/dutch-woman-guide-portrait.jpg",
    addedAt: "Nov 20, 2024",
  },
]

export const conversations = [
  {
    id: "conv-1",
    participantName: "Sarah Mitchell",
    participantAvatar: "/woman-tourist-portrait.jpg",
    participantType: "tourist" as const,
    tourName: "Historical Paris Walking Tour",
    lastMessage: "Thank you so much! We're really looking forward to the tour tomorrow.",
    lastMessageTime: "2 min ago",
    unreadCount: 2,
    isOnline: true,
    messages: [
      {
        id: "msg-1",
        senderId: "tourist-1",
        senderName: "Sarah Mitchell",
        senderAvatar: "/woman-tourist-portrait.jpg",
        content:
          "Hi Marie! I just booked your Historical Paris tour for December 15th. I'm traveling with my husband and we're so excited!",
        timestamp: "Dec 10, 2025 at 10:30 AM",
        isOwn: false,
      },
      {
        id: "msg-2",
        senderId: "guide-1",
        senderName: "Marie Dubois",
        senderAvatar: "/woman-guide-portrait.jpg",
        content:
          "Hello Sarah! Welcome aboard! I'm thrilled to have you and your husband join the tour. Is this your first time in Paris?",
        timestamp: "Dec 10, 2025 at 10:45 AM",
        isOwn: true,
      },
      {
        id: "msg-3",
        senderId: "tourist-1",
        senderName: "Sarah Mitchell",
        senderAvatar: "/woman-tourist-portrait.jpg",
        content:
          "Yes, it's our first time! We've been dreaming of visiting for years. Any tips on what to wear for the walking tour? We'll be there in winter.",
        timestamp: "Dec 10, 2025 at 11:00 AM",
        isOwn: false,
      },
      {
        id: "msg-4",
        senderId: "guide-1",
        senderName: "Marie Dubois",
        senderAvatar: "/woman-guide-portrait.jpg",
        content:
          "Great question! December can be chilly, around 5-10°C. I'd recommend comfortable walking shoes, a warm jacket, and layers. We'll be walking for about 2.5 hours with a few short stops.",
        timestamp: "Dec 10, 2025 at 11:15 AM",
        isOwn: true,
      },
      {
        id: "msg-5",
        senderId: "tourist-1",
        senderName: "Sarah Mitchell",
        senderAvatar: "/woman-tourist-portrait.jpg",
        content:
          "Perfect, thanks for the tips! Also, is there anywhere nearby you'd recommend for lunch after the tour?",
        timestamp: "Dec 10, 2025 at 2:00 PM",
        isOwn: false,
      },
      {
        id: "msg-6",
        senderId: "guide-1",
        senderName: "Marie Dubois",
        senderAvatar: "/woman-guide-portrait.jpg",
        content:
          "There's a lovely bistro called 'Le Petit Cler' just a 5-minute walk from where we end. They have amazing croque monsieurs and onion soup. I'll point it out during the tour!",
        timestamp: "Dec 10, 2025 at 2:30 PM",
        isOwn: true,
      },
      {
        id: "msg-7",
        senderId: "tourist-1",
        senderName: "Sarah Mitchell",
        senderAvatar: "/woman-tourist-portrait.jpg",
        content: "Thank you so much! We're really looking forward to the tour tomorrow.",
        timestamp: "Dec 10, 2025 at 3:00 PM",
        isOwn: false,
      },
    ],
  },
  {
    id: "conv-2",
    participantName: "James Chen",
    participantAvatar: "/asian-man-tourist-portrait.jpg",
    participantType: "tourist" as const,
    tourName: "Montmartre Art District",
    lastMessage: "What time should we arrive at the meeting point?",
    lastMessageTime: "1 hour ago",
    unreadCount: 1,
    isOnline: false,
    messages: [
      {
        id: "msg-1",
        senderId: "tourist-2",
        senderName: "James Chen",
        senderAvatar: "/asian-man-tourist-portrait.jpg",
        content: "Hello! I'm interested in the Montmartre tour on December 18th. Is there still availability?",
        timestamp: "Dec 9, 2025 at 4:00 PM",
        isOwn: false,
      },
      {
        id: "msg-2",
        senderId: "guide-1",
        senderName: "Marie Dubois",
        senderAvatar: "/woman-guide-portrait.jpg",
        content:
          "Hi James! Yes, we still have spots available for the 18th. The tour starts at 11 AM. Would you like me to save you a spot?",
        timestamp: "Dec 9, 2025 at 4:30 PM",
        isOwn: true,
      },
      {
        id: "msg-3",
        senderId: "tourist-2",
        senderName: "James Chen",
        senderAvatar: "/asian-man-tourist-portrait.jpg",
        content: "Yes please! I'll be booking for 2 people. What time should we arrive at the meeting point?",
        timestamp: "Dec 10, 2025 at 10:00 AM",
        isOwn: false,
      },
    ],
  },
  {
    id: "conv-3",
    participantName: "Emma Rodriguez",
    participantAvatar: "/latina-woman-tourist-portrait.jpg",
    participantType: "tourist" as const,
    tourName: "Historical Paris Walking Tour",
    lastMessage: "That was the best tour we've ever taken! Thank you!",
    lastMessageTime: "2 days ago",
    unreadCount: 0,
    isOnline: false,
    messages: [
      {
        id: "msg-1",
        senderId: "tourist-3",
        senderName: "Emma Rodriguez",
        senderAvatar: "/latina-woman-tourist-portrait.jpg",
        content:
          "Hi Marie! Just wanted to say that was the best tour we've ever taken! Your knowledge and passion for Paris really shone through.",
        timestamp: "Dec 8, 2025 at 5:00 PM",
        isOwn: false,
      },
      {
        id: "msg-2",
        senderId: "guide-1",
        senderName: "Marie Dubois",
        senderAvatar: "/woman-guide-portrait.jpg",
        content:
          "Thank you so much Emma! It was a pleasure having you and your family on the tour. I hope you enjoy the rest of your time in Paris! 🗼",
        timestamp: "Dec 8, 2025 at 5:30 PM",
        isOwn: true,
      },
      {
        id: "msg-3",
        senderId: "tourist-3",
        senderName: "Emma Rodriguez",
        senderAvatar: "/latina-woman-tourist-portrait.jpg",
        content:
          "We definitely will! Already left you a 5-star review. That was the best tour we've ever taken! Thank you!",
        timestamp: "Dec 8, 2025 at 6:00 PM",
        isOwn: false,
      },
    ],
  },
  {
    id: "conv-4",
    participantName: "David Thompson",
    participantAvatar: "/british-man-tourist-portrait.jpg",
    participantType: "tourist" as const,
    tourName: "Hidden Gems of Le Marais",
    lastMessage: "Can you accommodate a group of 8 people?",
    lastMessageTime: "3 days ago",
    unreadCount: 0,
    isOnline: true,
    messages: [
      {
        id: "msg-1",
        senderId: "tourist-4",
        senderName: "David Thompson",
        senderAvatar: "/british-man-tourist-portrait.jpg",
        content:
          "Hello! I'm organizing a trip for my company team and we're interested in your Le Marais tour. Can you accommodate a group of 8 people?",
        timestamp: "Dec 7, 2025 at 9:00 AM",
        isOwn: false,
      },
      {
        id: "msg-2",
        senderId: "guide-1",
        senderName: "Marie Dubois",
        senderAvatar: "/woman-guide-portrait.jpg",
        content:
          "Hi David! Yes, I can definitely accommodate a group of 8. For corporate groups, I can also offer a private tour option with customized content. Would you be interested in that?",
        timestamp: "Dec 7, 2025 at 10:00 AM",
        isOwn: true,
      },
    ],
  },
]

export const allReviews = [
  ...latestReviews,
  {
    id: "4",
    authorName: "David K.",
    authorAvatar: "/man-portrait-glasses.png",
    rating: 5,
    date: "1 week ago",
    content:
      "James made Westminster come alive! His knowledge of British royal history is impressive. We learned so much about the changing of the guard ceremony and the history behind Big Ben. Highly recommended for history buffs!",
    tourTitle: "Royal London: Westminster & Buckingham Palace",
    city: "London",
  },
  {
    id: "5",
    authorName: "Anna P.",
    authorAvatar: "/blonde-woman-portrait.png",
    rating: 4,
    date: "2 weeks ago",
    content:
      "Beautiful tour through Amsterdam's canal district. Anna was knowledgeable and friendly. The only reason I'm not giving 5 stars is that we could have spent more time at some locations. Otherwise, excellent!",
    tourTitle: "Amsterdam Canal District & Hidden Gems",
    city: "Amsterdam",
  },
  {
    id: "6",
    authorName: "Roberto M.",
    authorAvatar: "/italian-man-portrait.png",
    rating: 5,
    date: "2 weeks ago",
    content:
      "Jan's tour of Prague Castle was extraordinary! He showed us secret passages and told us stories I've never heard before. The view from the castle at sunset was breathtaking. A must-do in Prague!",
    tourTitle: "Prague Castle & Old Town Square Discovery",
    city: "Prague",
  },
  {
    id: "7",
    authorName: "Sophie L.",
    authorAvatar: "/french-woman-portrait.jpg",
    rating: 5,
    date: "3 weeks ago",
    content:
      "The Berlin Wall tour was emotionally moving and incredibly informative. Hans shared personal stories from his family that made the history feel so real. This tour should be on everyone's Berlin itinerary.",
    tourTitle: "Berlin Wall & Cold War History Tour",
    city: "Berlin",
  },
  {
    id: "8",
    authorName: "Tom B.",
    authorAvatar: "/bearded-man-portrait.png",
    rating: 5,
    date: "3 weeks ago",
    content:
      "Ana's passion for Fado music was infectious! She took us to local spots where we could hear authentic performances. The Alfama neighborhood is charming, and Ana knows every corner of it.",
    tourTitle: "Lisbon: Alfama & Fado Music District",
    city: "Lisbon",
  },
  {
    id: "9",
    authorName: "Jennifer W.",
    authorAvatar: "/brunette-woman-portrait.png",
    rating: 4,
    date: "1 month ago",
    content:
      "Great introduction to Vienna's imperial history. Franz was very knowledgeable about the Habsburg dynasty. We loved the coffee house stop at the end. Would have liked the tour to be slightly longer.",
    tourTitle: "Vienna Imperial Palace & Coffee House Tour",
    city: "Vienna",
  },
  {
    id: "10",
    authorName: "Chris D.",
    authorAvatar: "/young-man-portrait.png",
    rating: 5,
    date: "1 month ago",
    content:
      "Elena brought ancient Athens to life! Standing at the Acropolis while she described what it looked like 2,500 years ago was incredible. Her knowledge of Greek mythology added so much depth to the experience.",
    tourTitle: "Athens: Acropolis & Ancient Agora Walk",
    city: "Athens",
  },
  {
    id: "11",
    authorName: "Maria G.",
    authorAvatar: "/spanish-woman-portrait.png",
    rating: 5,
    date: "1 month ago",
    content:
      "Patrick's Dublin tour was the highlight of our Ireland trip! His storytelling about Irish literary giants was captivating, and the pub recommendations were spot on. Sláinte!",
    tourTitle: "Dublin Literary & Pub Heritage Tour",
    city: "Dublin",
  },
  {
    id: "12",
    authorName: "Alexander R.",
    authorAvatar: "/man-portrait-distinguished.jpg",
    rating: 5,
    date: "1 month ago",
    content:
      "Giulia's Renaissance art tour was like taking a masterclass in art history while walking through an open-air museum. Her insights about Michelangelo and the Medici family were fascinating. Florence is magical with the right guide!",
    tourTitle: "Florence Renaissance Art & History",
    city: "Florence",
  },
]

export const faqCategories = [
  {
    name: "For Travelers",
    faqs: [
      {
        question: "What is a free walking tour?",
        answer:
          "A free walking tour is a guided tour where you don't pay a fixed price upfront. Instead, at the end of the tour, you tip the guide based on your satisfaction and experience. This model ensures guides are motivated to deliver excellent tours while making travel experiences accessible to everyone.",
      },
      {
        question: "How much should I tip?",
        answer:
          "Tipping is flexible and depends on your satisfaction. Most travelers tip between €10-20 per person for a 2-3 hour tour. However, you're free to tip whatever feels right based on the experience, your budget, and local customs. Guides genuinely appreciate any contribution.",
      },
      {
        question: "Do I need to book in advance?",
        answer:
          "We strongly recommend booking in advance to secure your spot, especially for popular tours and during peak tourist seasons. However, if spots are available, you can join a tour on the same day. Booking ahead helps guides plan for group sizes.",
      },
      {
        question: "What if I need to cancel?",
        answer:
          "Life happens! You can cancel your booking for free up to 24 hours before the tour starts. For cancellations within 24 hours, we ask that you message your guide directly. Please cancel if you can't make it so others can take your spot.",
      },
      {
        question: "Are tours available in my language?",
        answer:
          "We offer tours in many languages including English, Spanish, French, German, Italian, Portuguese, and more. Each tour listing shows which languages the guide speaks. Use our filter options to find tours in your preferred language.",
      },
      {
        question: "What should I bring on a walking tour?",
        answer:
          "Wear comfortable walking shoes and dress for the weather. Bring water, especially in summer. A small umbrella can be handy. Don't forget cash for tipping your guide! Some tours involve walking on cobblestones or stairs, so check the tour description for accessibility information.",
      },
    ],
  },
  {
    name: "For Guides",
    faqs: [
      {
        question: "How do I become a guide on TipWalk?",
        answer:
          "Simply click 'Become a Guide' and complete our registration process. You'll provide information about yourself, your experience, and create your first tour. Once approved, your tour will be live and you can start accepting bookings!",
      },
      {
        question: "What are the requirements to be a guide?",
        answer:
          "We look for guides who are passionate about their city, have good communication skills, and can deliver engaging experiences. While formal guiding certifications are a plus, they're not always required. Some cities have licensing requirements, so check your local regulations.",
      },
      {
        question: "How much can I earn as a guide?",
        answer:
          "Earnings vary based on location, tour quality, and frequency. Top guides can earn €50-200+ per tour. Building great reviews helps attract more bookings. Premium features like Featured Listings can significantly boost your visibility and earnings.",
      },
      {
        question: "How do I get more bookings?",
        answer:
          "Focus on delivering exceptional experiences to build positive reviews. Complete your profile with a professional photo and detailed bio. Use premium features like Featured Listings and Search Boost to increase visibility. Respond quickly to messages and maintain high ratings.",
      },
    ],
  },
  {
    name: "Credits & Premium",
    faqs: [
      {
        question: "What are credits?",
        answer:
          "Credits are our platform currency that guides use to access premium features. These features help increase visibility, attract more bookings, and grow your guiding business. Credits can be purchased in packages at discounted rates.",
      },
      {
        question: "What premium features can I unlock?",
        answer:
          "Premium features include: Featured Listing (appear at the top of search results), Search Boost (higher ranking in searches), Profile Highlight (eye-catching badge on your profile), Priority Placement (premium positioning on city pages), and Advanced Analytics (detailed insights about your tours).",
      },
      {
        question: "Do credits expire?",
        answer:
          "Credits never expire! Once purchased, they remain in your account until you use them. This gives you flexibility to use them when it makes the most sense for your business, such as during peak tourist seasons.",
      },
      {
        question: "Can I get a refund for unused credits?",
        answer:
          "We don't offer refunds for purchased credits. However, since credits don't expire, you can always use them in the future. If you're having issues with your account, please contact our support team.",
      },
    ],
  },
  {
    name: "Booking & Payments",
    faqs: [
      {
        question: "Is my booking confirmed immediately?",
        answer:
          "Most bookings are confirmed instantly. However, some guides review bookings manually, especially for large groups or special requests. You'll receive a confirmation email once your booking is confirmed. You can also check your booking status in your account.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "For credit purchases, we accept all major credit cards, PayPal, and Apple Pay. Remember, tour tips are paid directly to your guide in cash at the end of the tour. Some guides may also accept digital payments like Venmo or PayPal.",
      },
      {
        question: "How do I contact my guide?",
        answer:
          "Once you've booked a tour, you can message your guide directly through our platform. Go to your bookings, select the tour, and use the 'Message Guide' button. Guides typically respond within a few hours.",
      },
    ],
  },
]

export const teamMembers = [
  {
    name: "Carlos Rodriguez",
    role: "Co-Founder & CEO",
    image: "/professional-hispanic-man-portrait.jpg",
    bio: "Former tour guide turned entrepreneur. Carlos founded TipWalk after 10 years of leading tours across Europe.",
  },
  {
    name: "Elena Kowalski",
    role: "Co-Founder & CTO",
    image: "/professional-woman-tech-portrait.png",
    bio: "Tech veteran with a passion for travel. Elena leads our engineering team in building the platform.",
  },
  {
    name: "Marcus Johnson",
    role: "Head of Guide Success",
    image: "/professional-african-american-man.png",
    bio: "Dedicated to helping guides succeed. Marcus ensures our guide community thrives.",
  },
  {
    name: "Sophie Chen",
    role: "Head of Product",
    image: "/professional-asian-woman.png",
    bio: "Product strategist focused on creating delightful experiences for travelers and guides alike.",
  },
]
