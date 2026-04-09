declare global {
  /* eslint-disable no-unused-vars */
  namespace Express {
    /* eslint-disable no-unused-vars */
    interface Request {
      auth: {
        userId: string
        sessionId: string
        email: string
        name: string
        image: string
        role: string
        orgId: string
        orgRole: string
      }
      rawBody?: Buffer
      metadata?: {
        ipAddress: string
        userAgent: string
        requestId: string
        timestamp: Date
      }
    }
    interface Response {
      responseTime?: number
    }
    /* eslint-enable no-unused-vars */
  }
}

export {}
