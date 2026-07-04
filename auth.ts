import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { rateLimit, clientIp } from "@/lib/rate-limit"

// AUTH-9: a missing signing secret in production means forgeable sessions.
const authSecret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET) must be set in production")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        shopId: { label: "ShopId", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password || !credentials?.shopId) return null

        const email = String(credentials.email)
        const shopId = String(credentials.shopId)

        // AUTH-6: throttle credential stuffing / brute force (per account + per IP).
        const ip = request instanceof Request ? clientIp(request) : "unknown"
        if (!rateLimit(`login:${shopId}:${email}`, 5, 5 * 60_000).allowed) return null
        if (!rateLimit(`login-ip:${ip}`, 30, 5 * 60_000).allowed) return null

        const user = await prisma.user.findFirst({
          where: { email, shopId, isActive: true },
          select: {
            id: true, name: true, email: true, password: true,
            role: true, shopId: true, isSuperAdmin: true, permissions: true,
            shop: { select: { name: true, status: true } },
          },
        })

        if (!user || !user.password) {
          // Equalize timing a little so missing-user vs wrong-password aren't trivially distinguishable.
          await bcrypt.compare(String(credentials.password), "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv")
          return null
        }

        const valid = await bcrypt.compare(String(credentials.password), user.password)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId,
          shopName: user.shop.name,
          shopStatus: user.shop.status,
          isSuperAdmin: user.isSuperAdmin,
          permissions: user.permissions as object | null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: seed the token from the authorized user.
      if (user) {
        token.id = user.id
        token.role = user.role
        token.shopId = user.shopId
        token.shopName = user.shopName
        token.shopStatus = user.shopStatus
        token.isSuperAdmin = user.isSuperAdmin ?? false
        token.permissions = user.permissions ?? null
        return token
      }

      // AUTH-5: on every subsequent request, re-validate against the DB so a
      // deactivated user / changed role / suspended shop takes effect
      // immediately instead of living in the JWT until expiry.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            isActive: true,
            role: true,
            isSuperAdmin: true,
            permissions: true,
            shop: { select: { name: true, status: true } },
          },
        })
        if (!dbUser || !dbUser.isActive) {
          // C1: Invalidate completely. Strip EVERY identifying / privilege claim
          // so a deactivated account cannot (a) slip past a guard with a truthy
          // session, nor (b) retain `isSuperAdmin` / `role` until JWT expiry.
          // Clearing token.id also short-circuits this very block next request.
          token.id = undefined
          token.shopId = undefined
          token.role = undefined
          token.shopName = undefined
          token.shopStatus = undefined
          token.isSuperAdmin = false
          return token
        }
        token.role = dbUser.role
        token.shopName = dbUser.shop?.name
        token.shopStatus = dbUser.shop?.status
        token.isSuperAdmin = dbUser.isSuperAdmin
        token.permissions = dbUser.permissions ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.shopId = token.shopId as string
        session.user.shopName = token.shopName as string
        session.user.shopStatus = token.shopStatus as string | undefined
        // Strict boolean: only an explicit `true` claim grants superadmin.
        session.user.isSuperAdmin = token.isSuperAdmin === true
        session.user.permissions = (token.permissions as typeof session.user.permissions) ?? null
      }
      return session
    },
  },
  // AUTH-5: bound session lifetime with a rolling refresh.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: authSecret,
  trustHost: true,
})
