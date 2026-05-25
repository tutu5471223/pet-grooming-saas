"use client"

import { useState } from "react"
import { DollarSign } from "lucide-react"
import { CollectPaymentDialog } from "@/components/dashboard/collect-payment-dialog"

interface Props {
  paymentId: string
  amount: number
}

export function CollectButton({ paymentId, amount }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        <DollarSign className="h-3.5 w-3.5" />
        收款
      </button>
      <CollectPaymentDialog
        paymentId={paymentId}
        amount={amount}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
