import type { Metadata } from "next"
import { notFound } from "next/navigation"
import CarDetailClient from "@/components/cars/car-detail-client"

async function getCar(id: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/cars/${id}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const car = await getCar(id)

  if (!car) {
    return { title: "Car not found | Touricho" }
  }

  return {
    title: `${car.title} | Touricho`,
    description:
      car.description?.slice(0, 155) ??
      `Rent a ${car.make ?? ""} ${car.model ?? ""} in ${car.city ?? "your destination"} on Touricho.`,
    openGraph: {
      images: car.images?.[0] ? [{ url: car.images[0] }] : [],
    },
  }
}

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const car = await getCar(id)

  if (!car) notFound()

  return <CarDetailClient carId={id} initialCar={car} />
}
