import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ContractSigner } from "@/components/contracts/contract-signer"
import { ContractPDFDownload } from "@/components/contracts/contract-pdf-download"
import { ContractRegisterClient } from "@/components/contracts/contract-register-client"
import { CheckCircle2, Scissors } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

async function getContractByToken(token: string) {
  return prisma.contract.findUnique({
    where: { token },
    include: {
      pet: { include: { customer: true } },
    },
  })
}

async function getShopName(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } })
  return shop?.name ?? "寵物美容店"
}

export default async function ContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const contract = await getContractByToken(token)

  // If no contract found by token, check if it's a shopId for new-customer registration
  if (!contract) {
    const shop = await prisma.shop.findUnique({
      where: { id: token },
      select: { id: true, name: true, contractTemplate: true },
    })
    if (shop) {
      return (
        <ContractRegisterClient
          shopId={shop.id}
          shopName={shop.name}
          contractTemplate={shop.contractTemplate ?? ""}
        />
      )
    }
    notFound()
  }

  if (contract.status === "SIGNED") {
    const shopName = await getShopName(contract.shopId)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">合約已完成簽署</h1>
          <p className="mt-2 text-gray-600">
            簽署時間：{formatDateTime(contract.signedAt)}
          </p>
          {contract.signerName && (
            <p className="text-gray-600">簽署人：{contract.signerName}</p>
          )}
          <div className="mt-4 rounded-xl bg-green-50 p-4 text-left">
            <p className="text-sm text-green-800">
              <strong>{contract.pet.name}</strong> 的定型化契約已由{" "}
              <strong>{contract.pet.customer.name}</strong> 完成簽署。
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <ContractPDFDownload
              data={{
                shopName,
                petName: contract.pet.name,
                species: contract.pet.species,
                breed: contract.pet.breed ?? null,
                customerName: contract.pet.customer.name,
                contractContent: contract.content,
                signedAt: contract.signedAt?.toISOString() ?? null,
                signerName: contract.signerName ?? null,
                signatureUrl: contract.signatureUrl ?? null,
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (contract.status === "EXPIRED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900">合約連結已過期</h1>
          <p className="mt-2 text-gray-500">請聯絡店家重新發送合約連結</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">寵物美容服務合約</span>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{contract.pet.name} 的合約</p>
            <p>{contract.pet.customer.name}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Pet info */}
        <div className="rounded-xl bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-800">本合約適用寵物</p>
          <p className="mt-1 text-lg font-bold text-indigo-900">
            {contract.pet.name}（{contract.pet.breed ?? contract.pet.species}）
          </p>
          <p className="text-sm text-indigo-700">飼主：{contract.pet.customer.name}</p>
        </div>

        {/* Contract content */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div
            className="prose prose-sm max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: contract.content }}
          />
        </div>

        {/* Signature section */}
        <ContractSigner contractId={contract.id} contractToken={contract.token} customerName={contract.pet.customer.name} />
      </div>
    </div>
  )
}
