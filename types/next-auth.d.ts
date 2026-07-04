import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      shopId: string
      shopName: string
      shopStatus?: string
      isSuperAdmin: boolean
      permissions?: {
        reports?: boolean
        expenses?: boolean
        void?: boolean
        refund?: boolean
        settings?: boolean
        staff?: boolean
      } | null
    }
  }
  interface User {
    role: string
    shopId: string
    shopName: string
    shopStatus?: string
    isSuperAdmin?: boolean
    permissions?: object | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    shopId?: string
    shopName?: string
    shopStatus?: string
    isSuperAdmin?: boolean
    permissions?: object | null
  }
}
