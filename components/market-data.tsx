"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Search, TrendingUp, TrendingDown } from "lucide-react"

interface MarketDataProps {
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
}

export function MarketData({ credentials }: MarketDataProps) {
  const [stockCode, setStockCode] = useState("")
  const [exchangeCode, setExchangeCode] = useState("")
  const [productType, setProductType] = useState("")
  const [quote, setQuote] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleGetQuote = async () => {
    if (!stockCode || !exchangeCode || !productType) {
      setError("Please fill all fields")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8000/api/market_quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          stock_code: stockCode,
          exchange_code: exchangeCode,
          product_type: productType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setQuote(data.quote)
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError("Network error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Get Market Quote</CardTitle>
          <CardDescription>Get real-time market data for stocks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stock_code">Stock Code</Label>
            <Input
              id="stock_code"
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
              placeholder="e.g., RELIANCE, TCS"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exchange_code">Exchange</Label>
            <Select value={exchangeCode} onValueChange={setExchangeCode}>
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
            <Label htmlFor="product_type">Product Type</Label>
            <Select value={productType} onValueChange={setProductType}>
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

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleGetQuote} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting Quote...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Get Quote
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {quote && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {stockCode} - {exchangeCode}
              </span>
              {quote.Success?.ltp > quote.Success?.prev_close ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </CardTitle>
            <CardDescription>Market Quote</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">LTP:</span>
                  <span className="font-semibold">₹{quote.Success?.ltp || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Open:</span>
                  <span>₹{quote.Success?.open || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">High:</span>
                  <span>₹{quote.Success?.high || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Low:</span>
                  <span>₹{quote.Success?.low || "N/A"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Prev Close:</span>
                  <span>₹{quote.Success?.prev_close || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Volume:</span>
                  <span>{quote.Success?.volume || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Change:</span>
                  <span
                    className={`${(quote.Success?.ltp - quote.Success?.prev_close) > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {quote.Success?.ltp && quote.Success?.prev_close
                      ? `₹${(quote.Success.ltp - quote.Success.prev_close).toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Change %:</span>
                  <span
                    className={`${(quote.Success?.ltp - quote.Success?.prev_close) > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {quote.Success?.ltp && quote.Success?.prev_close
                      ? `${(((quote.Success.ltp - quote.Success.prev_close) / quote.Success.prev_close) * 100).toFixed(2)}%`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
