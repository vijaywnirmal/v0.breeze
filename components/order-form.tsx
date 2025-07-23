"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ShoppingCart } from "lucide-react"

interface OrderFormProps {
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
}

interface Instrument {
  Token: string
  InstrumentName: string
  ShortName: string
  Series: string
  ExpiryDate: string
  StrikePrice: string
  OptionType: string
  ExchangeCode: string
}

export function OrderForm({ credentials }: OrderFormProps) {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null)
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/data/instrument-master.txt")
        const text = await response.text()
        const parsedInstruments = parseCSV(text)
        setInstruments(parsedInstruments)
      } catch (error) {
        console.error("Error fetching instrument data:", error)
        setMessage("Failed to load instrument data")
        setMessageType("error")
      }
    }

    fetchData()
  }, [])

  const parseCSV = (csvText: string): Instrument[] => {
    const lines = csvText.split("\n")
    const headers = lines[0].split(",")
    const result: Instrument[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",")
      if (values.length === headers.length) {
        const instrument: any = {}
        for (let j = 0; j < headers.length; j++) {
          instrument[headers[j]] = values[j].replace(/"/g, "")
        }
        result.push(instrument as Instrument)
      }
    }
    return result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedInstrument || !quantity) {
      setMessage("Please select an instrument and enter quantity")
      setMessageType("error")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const response = await fetch("http://localhost:8000/api/place_order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          stock_code: selectedInstrument.ShortName,
          exchange_code: selectedInstrument.ExchangeCode || "NSE",
          product_type: selectedInstrument.InstrumentName.startsWith("FUT") ? "futures" : "options",
          order_type: price ? "limit" : "market",
          price: price ? Number.parseFloat(price) : null,
          quantity: Number.parseInt(quantity),
          action: "buy", // Hardcoded for simplicity
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage("Order placed successfully!")
        setMessageType("success")
        // Reset form
        setSelectedInstrument(null)
        setQuantity("")
        setPrice("")
      } else {
        setMessage(data.message)
        setMessageType("error")
      }
    } catch (error) {
      setMessage("Network error occurred")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Place Order</CardTitle>
        <CardDescription>Select an instrument and place your order</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instrument">Instrument *</Label>
            <Select
              value={selectedInstrument ? selectedInstrument.Token : ""}
              onValueChange={(value) => {
                const instrument = instruments.find((i) => i.Token === value)
                setSelectedInstrument(instrument || null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                {instruments.map((instrument) => (
                  <SelectItem key={instrument.Token} value={instrument.Token}>
                    {instrument.InstrumentName} ({instrument.ShortName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (for limit orders)</Label>
              <Input
                id="price"
                type="number"
                placeholder="Enter price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                step="0.01"
                disabled={!selectedInstrument || selectedInstrument.InstrumentName.startsWith("FUT")}
              />
            </div>
          </div>

          {message && (
            <Alert variant={messageType === "error" ? "destructive" : "default"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading || !selectedInstrument || !quantity} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Placing Order...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Place Order
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
