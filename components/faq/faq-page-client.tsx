"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, HelpCircle, MessageCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { faqCategories } from "@/lib/mock-data"

export function FAQPageClient() {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredFaqs = faqCategories.map((category) => ({
    ...category,
    faqs: category.faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  }))

  const hasResults = filteredFaqs.some((category) => category.faqs.length > 0)

  return (
    <>
      <section className="public-hero-section py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="public-template-heading text-4xl font-bold tracking-tight lg:text-5xl">Frequently Asked Questions</h1>
          <p className="public-template-copy mt-4 max-w-2xl mx-auto text-lg">
            Find answers to common questions about tours, booking, becoming a guide, and more.
          </p>

          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search for answers..."
                className="h-12 border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] pl-12 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="public-section py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {searchQuery ? (
            <div>
              {hasResults ? (
                <div className="space-y-8">
                  {filteredFaqs.map(
                    (category) =>
                      category.faqs.length > 0 && (
                        <div key={category.name}>
                          <h2 className="public-template-heading mb-4 text-xl font-semibold">{category.name}</h2>
                          <Accordion type="single" collapsible className="space-y-2">
                            {category.faqs.map((faq, index) => (
                              <AccordionItem
                                key={index}
                                value={`${category.name}-${index}`}
                                className="rounded-lg border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4"
                              >
                                <AccordionTrigger className="text-left hover:no-underline">
                                  {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      ),
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <HelpCircle className="mx-auto mb-4 h-12 w-12 text-[color:var(--landing-muted-2)]" />
                  <h3 className="text-lg font-medium text-[color:var(--landing-ink)]">No results found</h3>
                  <p className="mt-2 text-[color:var(--landing-muted)]">
                    Try searching for something else or browse our categories below.
                  </p>
                  <Button className="landing-btn-coral mt-4" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Tabs defaultValue="For Travelers" className="w-full">
              <TabsList className="mb-8 h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                {faqCategories.map((category) => (
                  <TabsTrigger
                    key={category.name}
                    value={category.name}
                    className="rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-6 text-[color:var(--landing-muted)] data-[state=active]:border-[color:var(--landing-border-2)] data-[state=active]:bg-[color:var(--landing-accent-soft)] data-[state=active]:text-[color:var(--landing-accent)]"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {faqCategories.map((category) => (
                <TabsContent key={category.name} value={category.name}>
                  <Accordion type="single" collapsible className="space-y-2">
                    {category.faqs.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`} className="rounded-lg border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] px-4">
                        <AccordionTrigger className="text-left hover:no-underline">{faq.question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </section>

      <section className="public-section-soft py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="public-template-heading text-2xl font-bold">Still need help?</h2>
            <p className="public-template-copy mt-2">Our support team is here to assist you</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="public-shell-card">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Live Chat</CardTitle>
                <CardDescription>Chat with our support team in real-time</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="landing-btn-coral w-full">Start Chat</Button>
              </CardContent>
            </Card>

            <Card className="public-shell-card">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Email Support</CardTitle>
                <CardDescription>We'll respond within 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full border-[color:var(--landing-border-2)] bg-transparent text-[color:var(--landing-muted)] hover:bg-[color:var(--landing-accent-soft)] hover:text-[color:var(--landing-accent)]" asChild>
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  )
}
