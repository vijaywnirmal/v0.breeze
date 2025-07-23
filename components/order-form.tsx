"use client"

import type React from "react"

import { useState } from "react"
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

export function OrderForm({ credentials }: OrderFormProps) {
  const [formData, setFormData] = useState({
    stock_code: "",
    exchange_code: "",
    product_type: "",
    order_type: "",
    price: "",
    quantity: "",
    action: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.stock_code ||
      !formData.exchange_code ||
      !formData.product_type ||
      !formData.order_type ||
      !formData.quantity ||
      !formData.action
    ) {
      setMessage("Please fill all required fields")
      setMessageType("error")
      return
    }

    if (formData.order_type === "limit" && !formData.price) {
      setMessage("Price is required for limit orders")
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
          ...formData,
          price: formData.price ? Number.parseFloat(formData.price) : null,
          quantity: Number.parseInt(formData.quantity),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage("Order placed successfully!")
        setMessageType("success")
        // Reset form
        setFormData({
          stock_code: "",
          exchange_code: "",
          product_type: "",
          order_type: "",
          price: "",
          quantity: "",
          action: "",
        })
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Place Order</CardTitle>
        <CardDescription>Place buy or sell orders for stocks and derivatives</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock_code">Stock Code *</Label>
              <Input
                id="stock_code"
                value={formData.stock_code}
                onChange={(e) => handleChange("stock_code", e.target.value)}
                placeholder="e.g., RELIANCE, TCS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exchange_code">Exchange *</Label>
              <Select value={formData.exchange_code} onValueChange={(value) => handleChange("exchange_code", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                  <SelectItem value="NFO">NFO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_type">Product Type *</Label>
              <Select value={formData.product_type} onValueChange={(value) => handleChange("product_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="futures">Futures</SelectItem>
                  <SelectItem value="options">Options</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_type">Order Type *</Label>
              <Select value={formData.order_type} onValueChange={(value) => handleChange("order_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select order type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="limit">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
                placeholder="Enter quantity"
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price {formData.order_type === "limit" && "*"}</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => handleChange("price", e.target.value)}
                placeholder="Enter price (for limit orders)"
                step="0.01"
                disabled={formData.order_type === "market"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action *</Label>
            <Select value={formData.action} onValueChange={(value) => handleChange("action", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {message && (
            <Alert variant={messageType === "error" ? "destructive" : "default"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
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
