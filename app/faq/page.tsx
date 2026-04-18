import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { FAQPageClient } from "@/components/faq/faq-page-client"

export default function FAQPage() {
  return (
    <div className="public-template-page landing-template">
      <Navbar variant="landingTemplate" />
      <FAQPageClient />
      <Footer variant="landingTemplate" />
    </div>
  )
}
