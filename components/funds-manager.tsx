"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowUpCircle, ArrowDownCircle } from "lucide-react"

interface FundsManagerProps {
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
  onFundsUpdate: (funds: any) => void
  currentFunds: any
}

export function FundsManager({ credentials, onFundsUpdate, currentFunds }: FundsManagerProps) {
  const [amount, setAmount] = useState("")
  const [segment, setSegment] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "">("")

  const handleAllocate = async () => {
    if (!amount || !segment) {
      setMessage("Please enter amount and select segment")
      setMessageType("error")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const response = await fetch("http://localhost:8000/api/allocate_funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          amount: Number.parseFloat(amount),
          segment: segment,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`Successfully allocated ₹${amount} to ${segment}`)
        setMessageType("success")
        onFundsUpdate(data.funds)
        setAmount("")
        setSegment("")
      } else {
        setMessage(data.message || "Allocation failed")
        setMessageType("error")
      }
    } catch (error) {
      setMessage("Connection error")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnallocate = async () => {
    if (!amount || !segment) {
      setMessage("Please enter amount and select segment")
      setMessageType("error")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const response = await fetch("http://localhost:8000/api/unallocate_funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          amount: Number.parseFloat(amount),
          segment: segment,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`Successfully unallocated ₹${amount} from ${segment}`)
        setMessageType("success")
        onFundsUpdate(data.funds)
        setAmount("")
        setSegment("")
      } else {
        setMessage(data.message || "Unallocation failed")
        setMessageType("error")
      }
    } catch (error) {
      setMessage("Connection error")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Fund Allocation</CardTitle>
          <CardDescription>Allocate or unallocate funds between different segments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment">Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger>
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="fno">F&O</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleAllocate} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="mr-2 h-4 w-4" />
              )}
              Allocate
            </Button>
            <Button onClick={handleUnallocate} disabled={isLoading} variant="outline" className="flex-1 bg-transparent">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownCircle className="mr-2 h-4 w-4" />
              )}
              Unallocate
            </Button>
          </div>
          {message && (
            <Alert variant={messageType === "error" ? "destructive" : "default"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Fund Status</CardTitle>
          <CardDescription>Overview of your current fund allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Total Bank Balance</span>
              <span className="text-lg font-bold">₹{currentFunds?.total_bank_balance || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="font-medium">Unallocated Balance</span>
              <span className="text-lg font-bold text-blue-600">₹{currentFunds?.unallocated_balance || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="font-medium">Equity Allocated</span>
              <span className="text-lg font-bold text-green-600">₹{currentFunds?.allocated_equity || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="font-medium">F&O Allocated</span>
              <span className="text-lg font-bold text-purple-600">₹{currentFunds?.allocated_fno || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
