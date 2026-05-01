"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Star, Search, MapPin, ChevronDown, Quote, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type PublicReviewItem = {
  id: string
  authorName: string
  authorAvatar: string
  rating: number
  date: string
  createdAt: string
  content: string
  tourTitle: string
  city: string
}

interface ReviewsClientProps {
  reviews: PublicReviewItem[]
  totalReviews: number
}

export function ReviewsClient({ reviews, totalReviews }: ReviewsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState("all")
  const [selectedRating, setSelectedRating] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [visibleCount, setVisibleCount] = useState(9)

  useEffect(() => {
    setVisibleCount(9)
  }, [searchQuery, selectedCity, selectedRating, sortBy])

  const cities = useMemo(() => {
    return Array.from(new Set(reviews.map((review) => review.city).filter(Boolean))).sort()
  }, [reviews])

  const computedStats = useMemo(() => {
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        fiveStarPercentage: 0,
        recommendRate: 0,
      }
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const fiveStarCount = reviews.filter((review) => review.rating === 5).length
    const recommendCount = reviews.filter((review) => review.rating >= 4).length

    return {
      averageRating: totalRating / reviews.length,
      fiveStarPercentage: Math.round((fiveStarCount / reviews.length) * 100),
      recommendRate: Math.round((recommendCount / reviews.length) * 100),
    }
  }, [reviews])

  const featuredReview = useMemo(() => {
    if (reviews.length === 0) return null
    return [...reviews].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })[0]
  }, [reviews])

  const filteredReviews = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const filtered = reviews.filter((review) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        review.content.toLowerCase().includes(normalizedQuery) ||
        review.tourTitle.toLowerCase().includes(normalizedQuery) ||
        review.authorName.toLowerCase().includes(normalizedQuery) ||
        review.city.toLowerCase().includes(normalizedQuery)

      const matchesCity = selectedCity === "all" || review.city === selectedCity
      const matchesRating = selectedRating === "all" || review.rating === Number.parseInt(selectedRating, 10)

      return matchesSearch && matchesCity && matchesRating
    })

    return filtered.sort((a, b) => {
      if (sortBy === "highest") return b.rating - a.rating
      if (sortBy === "lowest") return a.rating - b.rating
      if (sortBy === "city") return a.city.localeCompare(b.city)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [reviews, searchQuery, selectedCity, selectedRating, sortBy])

  const listReviews = featuredReview
    ? filteredReviews.filter((review) => review.id !== featuredReview.id)
    : filteredReviews
  const visibleReviews = listReviews.slice(0, visibleCount)
  const canLoadMore = visibleCount < listReviews.length

  return (
    <>
      <section className="public-hero-section py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="public-template-heading text-4xl font-bold tracking-tight lg:text-5xl">Real Stories from Real Travelers</h1>
            <p className="public-template-copy mt-4 max-w-2xl mx-auto text-lg">
              Verified feedback from people who actually booked and joined tours on Touricho.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{(totalReviews || reviews.length).toLocaleString()}</p>
              <p className="text-sm text-[color:var(--landing-muted)]">Verified Reviews</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-3xl font-bold">{computedStats.averageRating.toFixed(1)}</p>
                <Star className="w-6 h-6 fill-chart-3 text-chart-3" />
              </div>
              <p className="text-sm text-[color:var(--landing-muted)]">Average Rating</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-secondary">{computedStats.fiveStarPercentage}%</p>
              <p className="text-sm text-[color:var(--landing-muted)]">5-Star Reviews</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="w-5 h-5 text-secondary" />
                <p className="text-3xl font-bold">{computedStats.recommendRate}%</p>
              </div>
              <p className="text-sm text-[color:var(--landing-muted)]">Would Recommend</p>
            </div>
          </div>
        </div>
      </section>

      {featuredReview && (
        <section className="public-section py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="secondary" className="border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)]">
                Featured Review
              </Badge>
            </div>
            <Card className="public-shell-card-muted shadow-lg">
              <CardContent className="p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                  <Quote className="w-12 h-12 text-primary/20 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="public-template-copy text-lg leading-relaxed italic">"{featuredReview.content}"</p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={featuredReview.authorAvatar || undefined} />
                          <AvatarFallback>{featuredReview.authorName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{featuredReview.authorName}</p>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < featuredReview.rating ? "fill-chart-3 text-chart-3" : "text-muted-foreground/40"}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {featuredReview.tourTitle}
                        {featuredReview.city ? ` - ${featuredReview.city}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section className="public-section sticky top-16 z-20 py-8 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-shell-card flex flex-col gap-4 p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reviews, tours, cities..."
                className="border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRating} onValueChange={setSelectedRating}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="highest">Highest Rated</SelectItem>
                <SelectItem value="lowest">Lowest Rated</SelectItem>
                <SelectItem value="city">City A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="public-section py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleReviews.map((review) => (
              <Card key={review.id} className="landing-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={review.authorAvatar || undefined} />
                        <AvatarFallback>{review.authorName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{review.authorName}</p>
                        <p className="text-xs text-muted-foreground">{review.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < review.rating ? "fill-chart-3 text-chart-3" : "text-muted-foreground/40"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-4 mb-4">"{review.content}"</p>
                  <div className="pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{review.tourTitle}</span>
                    {review.city && (
                      <Badge variant="secondary" className="ml-auto border border-[color:var(--landing-border-2)] bg-[color:var(--landing-accent-soft)] text-[color:var(--landing-accent)]">
                        {review.city}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {listReviews.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[color:var(--landing-muted)]">No reviews found matching your criteria.</p>
              <Button
                variant="outline"
                className="mt-4 border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCity("all")
                  setSelectedRating("all")
                  setSortBy("recent")
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {canLoadMore && (
            <div className="text-center mt-12">
              <Button variant="outline" size="lg" className="border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]" onClick={() => setVisibleCount((current) => current + 9)}>
                Load More Reviews
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="public-section-soft py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="public-template-heading text-2xl font-bold">Ready to create your own story?</h2>
          <p className="public-template-copy mt-2">
            Join travelers discovering cities with local guides every day.
          </p>
          <Button size="lg" className="landing-btn-coral mt-6" asChild>
            <Link href="/tours">Find Your Tour</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
