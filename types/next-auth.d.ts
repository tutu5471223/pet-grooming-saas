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
      isSuperAdmin: boolean
    }
  }
  interface User {
    role: string
    shopId: string
    shopName: string
    isSuperAdmin?: boolean
  }
}
