"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  const [exchangeCode, setExchangeCode] = useState("NSE")
  const [isLoading, setIsLoading] = useState(false)
  const [marketData, setMarketData] = useState<any>(null)
  const [error, setError] = useState("")

  const handleGetQuote = async () => {
    if (!stockCode) {
      setError("Please enter a stock code")
      return
    }

    setIsLoading(true)
    setError("")
    setMarketData(null)

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
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMarketData(data.quote)
      } else {
        setError(data.message || "Failed to fetch quote")
      }
    } catch (error) {
      setError("Connection error")
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(price)
  }

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return "text-green-600"
    if (change < 0) return "text-red-600"
    return "text-gray-600"
  }

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />
    if (change < 0) return <TrendingDown className="h-4 w-4" />
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Get Market Quote</CardTitle>
          <CardDescription>Enter stock code to get real-time market data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stockCode">Stock Code</Label>
            <Input
              id="stockCode"
              type="text"
              placeholder="e.g., RELIANCE, TCS, INFY"
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exchangeCode">Exchange</Label>
            <Input
              id="exchangeCode"
              type="text"
              value={exchangeCode}
              onChange={(e) => setExchangeCode(e.target.value.toUpperCase())}
              placeholder="NSE, BSE"
            />
          </div>
          <Button onClick={handleGetQuote} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching Quote...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Get Quote
              </>
            )}
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {marketData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{marketData.stock_code}</span>
              <Badge variant="outline">{marketData.exchange_code}</Badge>
            </CardTitle>
            <CardDescription>Real-time market data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold">{formatPrice(marketData.ltp || 0)}</div>
                <div
                  className={`flex items-center justify-center space-x-1 ${getPriceChangeColor(marketData.change || 0)}`}
                >
                  {getPriceChangeIcon(marketData.change || 0)}
                  <span className="font-medium">
                    {marketData.change > 0 ? "+" : ""}
                    {marketData.change?.toFixed(2) || 0}({marketData.change_percentage > 0 ? "+" : ""}
                    {marketData.change_percentage?.toFixed(2) || 0}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">High</div>
                  <div className="font-bold text-green-600">{formatPrice(marketData.high || 0)}</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600">Low</div>
                  <div className="font-bold text-red-600">{formatPrice(marketData.low || 0)}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Open</div>
                  <div className="font-bold text-blue-600">{formatPrice(marketData.open || 0)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Volume</div>
                  <div className="font-bold">{marketData.volume?.toLocaleString() || 0}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
