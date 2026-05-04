erDiagram
User {
String id
String name
String email
DateTime emailVerified
String image
Boolean isMachine
DateTime createdAt
String passwordHash
Int invalidLoginAttempts
DateTime lockedAt
String defaultWorkspace
String defaultPartnerId
String source
Boolean sentMail
}
Account {
String id
String userId
String type
String provider
String providerAccountId
String refresh_token
Int refresh_token_expires_in
String access_token
Int expires_at
String token_type
String scope
String id_token
String session_state
}
Session {
String id
String sessionToken
String userId
DateTime expires
}
ActivityLog {
String id
String workspaceId
String programId
String parentResourceType
String parentResourceId
String resourceType
String resourceId
String userId
String action
String description
String batchId
Json changeSet
DateTime createdAt
}
Bounty {
String id
String programId
String workflowId
String name
String description
enum type
DateTime startsAt
DateTime endsAt
DateTime submissionsOpenAt
enum submissionFrequency
Int maxSubmissions
Int rewardAmount
String rewardDescription
enum performanceScope
Json submissionRequirements
DateTime socialMetricsLastSyncedAt
DateTime archivedAt
DateTime createdAt
DateTime updatedAt
}
BountyGroup {
String id
String bountyId
String groupId
}
BountySubmission {
String id
String programId
String partnerId
String bountyId
BigInt performanceCount
Int socialMetricCount
String commissionId
String userId
String description
enum status
enum rejectionReason
String rejectionNote
Json files
Json urls
Int periodNumber
DateTime socialMetricsLastSyncedAt
DateTime completedAt
DateTime reviewedAt
DateTime createdAt
DateTime updatedAt
}
Campaign {
String id
String programId
String workflowId
String userId
String qstashMessageId
enum type
enum status
String name
String subject
String preview
String from
Json bodyJson
DateTime scheduledAt
DateTime createdAt
DateTime updatedAt
}
CampaignGroup {
String id
String campaignId
String groupId
}
PartnerComment {
String id
String programId
String partnerId
String userId
String text
DateTime createdAt
DateTime updatedAt
}
Commission {
String id
String programId
String partnerId
String rewardId
String linkId
String payoutId
String invoiceId
String customerId
String eventId
String description
enum type
Int amount
Int quantity
Int earnings
String currency
enum status
String userId
DateTime createdAt
DateTime updatedAt
}
Customer {
String id
String name
String email
String avatar
String externalId
String stripeCustomerId
String linkId
String clickId
DateTime clickedAt
String country
Int sales
BigInt saleAmount
DateTime firstSaleAt
DateTime subscriptionCanceledAt
String projectId
String projectConnectId
String programId
String partnerId
DateTime createdAt
DateTime updatedAt
}
Dashboard {
String id
String linkId
String folderId
String projectId
String userId
Boolean doIndex
String password
Boolean showConversions
DateTime createdAt
DateTime updatedAt
}
Discount {
String id
String programId
Int amount
enum type
Int maxDuration
String description
String couponId
String couponTestId
DateTime autoProvisionEnabledAt
DateTime createdAt
DateTime updatedAt
}
DiscountCode {
String id
String code
String programId
String discountId
String partnerId
String linkId
DateTime createdAt
DateTime updatedAt
}
Domain {
String id
String slug
Boolean verified
String placeholder
String expiredUrl
String notFoundUrl
Boolean primary
Boolean archived
DateTime lastChecked
String logo
Json appleAppSiteAssociation
Json assetLinks
Json deepviewData
Int linkRetentionDays
DateTime createdAt
DateTime updatedAt
String projectId
}
RegisteredDomain {
String id
String slug
String projectId
String domainId
DateTime autoRenewalDisabledAt
Int renewalFee
DateTime expiresAt
DateTime createdAt
DateTime updatedAt
}
DefaultDomains {
String id
Boolean dublink
Boolean dubsh
Boolean chatgpt
Boolean sptifi
Boolean gitnew
Boolean callink
Boolean amznid
Boolean ggllink
Boolean figpage
Boolean loooooooong
String projectId
}
EmailDomain {
String id
String workspaceId
String programId
String slug
enum status
String resendDomainId
DateTime lastChecked
DateTime createdAt
DateTime updatedAt
}
Folder {
String id
String name
String description
String projectId
enum type
enum accessLevel
DateTime createdAt
DateTime updatedAt
}
FolderUser {
String id
String folderId
String userId
enum role
DateTime createdAt
DateTime updatedAt
}
FolderAccessRequest {
String id
String folderId
String userId
DateTime createdAt
}
FraudRule {
String id
String programId
enum type
Json config
DateTime disabledAt
DateTime createdAt
DateTime updatedAt
}
FraudEventGroup {
String id
String programId
String partnerId
enum type
DateTime lastEventAt
Int eventCount
String userId
String resolutionReason
DateTime resolvedAt
enum status
DateTime createdAt
DateTime updatedAt
}
FraudEvent {
String id
String fraudEventGroupId
String programId
String partnerId
String linkId
String customerId
String eventId
String sourceProgramId
String hash
Json metadata
DateTime createdAt
DateTime updatedAt
}
PartnerGroup {
String id
String programId
String name
String slug
String color
String clickRewardId
String leadRewardId
String saleRewardId
String discountId
enum linkStructure
Json additionalLinks
Int maxPartnerLinks
Json applicationFormData
DateTime applicationFormPublishedAt
Json landerData
DateTime landerPublishedAt
String logo
String wordmark
String brandColor
Int holdingPeriodDays
DateTime autoApprovePartnersEnabledAt
String workflowId
String utmTemplateId
DateTime createdAt
DateTime updatedAt
}
PartnerGroupDefaultLink {
String id
String programId
String groupId
String domain
String url
DateTime createdAt
DateTime updatedAt
}
Integration {
String id
String userId
String projectId
String name
String slug
String description
String readme
String developer
String website
String logo
Json screenshots
Boolean verified
String installUrl
String guideUrl
String category
Boolean comingSoon
DateTime createdAt
DateTime updatedAt
}
InstalledIntegration {
String id
String userId
String integrationId
String projectId
DateTime createdAt
DateTime updatedAt
Json credentials
Json settings
}
Invoice {
String id
String programId
String workspaceId
String number
enum status
enum type
enum payoutMode
enum paymentMethod
Int amount
Int fee
Int total
Int externalAmount
String receiptUrl
String failedReason
Json registeredDomains
Json stripeChargeMetadata
Int failedAttempts
DateTime createdAt
DateTime paidAt
}
jackson_index {
Int id
String key
String storeKey
}
jackson_store {
String key
String value
String iv
String tag
String namespace
DateTime createdAt
DateTime modifiedAt
}
jackson_ttl {
String key
BigInt expiresAt
}
Link {
String id
String domain
String key
String url
String shortLink
Boolean archived
DateTime expiresAt
String expiredUrl
DateTime disabledAt
String password
Boolean trackConversion
Boolean proxy
String title
String description
String image
String video
String utm_source
String utm_medium
String utm_campaign
String utm_term
String utm_content
Boolean rewrite
DateTime linkRetentionCleanupDisabledAt
Boolean doIndex
String ios
String android
Json geo
Json testVariants
DateTime testStartedAt
DateTime testCompletedAt
String userId
String projectId
String folderId
String externalId
String tenantId
Boolean publicStats
Int clicks
Int leads
Int conversions
Int sales
BigInt saleAmount
DateTime lastClicked
DateTime lastLeadAt
DateTime lastConversionAt
DateTime createdAt
DateTime updatedAt
String comments
String programId
String partnerId
String partnerGroupDefaultLinkId
}
Message {
String id
String programId
String partnerId
String senderUserId
String senderPartnerId
enum type
String subject
String text
DateTime readInApp
DateTime readInEmail
DateTime createdAt
DateTime updatedAt
}
YearInReview {
String id
Int year
Int totalLinks
Int totalClicks
Json topLinks
Json topCountries
String workspaceId
DateTime createdAt
DateTime sentAt
}
PartnerRewind {
String id
Int year
Int totalClicks
Int totalLeads
Int totalRevenue
Int totalEarnings
String partnerId
DateTime createdAt
DateTime sentAt
}
ProgramCategory {
String programId
enum category
}
ProgramSimilarity {
String id
String programId
String similarProgramId
Float similarityScore
Float categorySimilarityScore
Float partnerSimilarityScore
Float performanceSimilarityScore
}
DiscoveredPartner {
String id
String programId
String partnerId
DateTime starredAt
DateTime ignoredAt
DateTime invitedAt
DateTime messagedAt
DateTime createdAt
DateTime updatedAt
}
NotificationEmail {
String id
String emailId
enum type
String messageId
String bountyId
String campaignId
String programId
String partnerId
String recipientUserId
DateTime deliveredAt
DateTime openedAt
DateTime bouncedAt
DateTime createdAt
}
UserNotificationPreferences {
String id
String userId
Boolean dubLinks
Boolean dubPartners
Boolean partnerAccount
}
NotificationPreference {
String id
String projectUserId
Boolean linkUsageSummary
Boolean domainConfigurationUpdates
Boolean newPartnerSale
Boolean newPartnerApplication
Boolean pendingApplicationsSummary
Boolean newBountySubmitted
Boolean newMessageFromPartner
Boolean fraudEventsSummary
}
PartnerNotificationPreferences {
String id
String partnerUserId
Boolean commissionCreated
Boolean applicationApproved
Boolean newMessageFromProgram
Boolean marketingCampaign
Boolean connectPayoutReminder
}
OAuthApp {
String id
String integrationId
String clientId
String hashedClientSecret
String partialClientSecret
Json redirectUris
Boolean pkce
}
OAuthCode {
String id
String clientId
String userId
String projectId
String code
String scopes
String redirectUri
String codeChallenge
String codeChallengeMethod
DateTime expiresAt
DateTime createdAt
}
OAuthRefreshToken {
String id
String installationId
String accessTokenId
String hashedRefreshToken
DateTime expiresAt
DateTime createdAt
}
Partner {
String id
String name
String companyName
enum profileType
String email
String image
String description
String country
enum defaultPayoutMethod
DateTime payoutsEnabledAt
DateTime connectPayoutsLastRemindedAt
String paypalEmail
String stripeConnectId
String stripeRecipientId
String payoutMethodHash
String cryptoWalletAddress
DateTime createdAt
DateTime updatedAt
DateTime discoverableAt
DateTime trustedAt
Json invoiceSettings
Json changeHistoryLog
enum monthlyTraffic
}
PartnerInvite {
String email
DateTime expires
String partnerId
enum role
DateTime createdAt
}
PartnerUser {
String id
enum role
String userId
String partnerId
DateTime createdAt
DateTime updatedAt
}
PartnerIndustryInterest {
String partnerId
enum industryInterest
}
PartnerPreferredEarningStructure {
String partnerId
enum preferredEarningStructure
}
PartnerSalesChannel {
String partnerId
enum salesChannel
}
Payout {
String id
String programId
String partnerId
String invoiceId
Int amount
String currency
enum status
enum mode
enum method
String description
DateTime periodStart
DateTime periodEnd
String paypalTransferId
String stripeTransferId
String stripePayoutId
String stripePayoutTraceId
String failureReason
String webhookEventId
DateTime createdAt
DateTime updatedAt
String userId
DateTime initiatedAt
DateTime paidAt
}
PartnerPlatform {
String id
String partnerId
enum type
String identifier
String platformId
String avatarUrl
BigInt subscribers
BigInt posts
BigInt views
Json metadata
DateTime createdAt
DateTime updatedAt
DateTime verifiedAt
DateTime lastCheckedAt
}
Postback {
String id
String partnerId
String name
String url
String secret
Json triggers
enum receiver
DateTime disabledAt
DateTime createdAt
DateTime updatedAt
}
Program {
String id
String workspaceId
String defaultFolderId
String defaultGroupId
String name
String slug
String domain
String url
String logo
String description
enum primaryRewardEvent
Int minPayoutAmount
enum payoutMode
Json inviteEmailData
Json embedData
Json resources
Json referralFormData
Json applicationRequirements
String termsUrl
String helpUrl
String supportEmail
DateTime messagingEnabledAt
DateTime partnerNetworkEnabledAt
DateTime createdAt
DateTime updatedAt
DateTime startedAt
DateTime deactivatedAt
DateTime addedToMarketplaceAt
DateTime featuredOnMarketplaceAt
String marketplaceHeaderImage
Int marketplaceRanking
}
ProgramEnrollment {
String id
String partnerId
String programId
String tenantId
String groupId
String applicationId
String clickRewardId
String leadRewardId
String saleRewardId
String discountId
enum status
Int totalClicks
Int totalLeads
Int totalConversions
Int totalSales
BigInt totalSaleAmount
BigInt totalCommissions
BigInt netRevenue
Float earningsPerClick
Float averageLifetimeValue
Float clickToLeadRate
Float clickToConversionRate
Float leadToConversionRate
Float returnOnAdSpend
DateTime lastConversionAt
Int daysSinceLastConversion
Int consistencyScore
DateTime createdAt
DateTime updatedAt
DateTime customerDataSharingEnabledAt
DateTime groupMoveDisabledAt
DateTime bannedAt
enum bannedReason
}
ProgramApplication {
String id
String programId
String groupId
String name
String email
String country
String website
String youtube
String twitter
String linkedin
String instagram
String tiktok
Json formData
String userId
enum rejectionReason
String rejectionNote
DateTime reviewedAt
DateTime createdAt
DateTime updatedAt
}
PartnerReferral {
String id
String programId
String partnerId
String customerId
String name
String email
String company
Json formData
enum status
DateTime createdAt
DateTime updatedAt
}
Reward {
String id
String programId
String description
String tooltipDescription
enum event
enum type
Int amountInCents
Decimal amountInPercentage
Int maxDuration
Json modifiers
DateTime createdAt
DateTime updatedAt
}
Tag {
String id
String name
String color
DateTime createdAt
DateTime updatedAt
String projectId
}
LinkTag {
String id
DateTime createdAt
DateTime updatedAt
String linkId
String tagId
}
Token {
String id
String name
String hashedKey
String partialKey
DateTime expires
DateTime lastUsed
DateTime createdAt
DateTime updatedAt
String userId
}
RestrictedToken {
String id
String name
String hashedKey
String partialKey
String scopes
DateTime expires
DateTime lastUsed
DateTime createdAt
DateTime updatedAt
String userId
String projectId
String installationId
}
VerificationToken {
String identifier
String token
DateTime expires
}
EmailVerificationToken {
String identifier
String token
DateTime expires
}
PasswordResetToken {
String identifier
String token
DateTime expires
}
UtmTemplate {
String id
String name
String utm_source
String utm_medium
String utm_campaign
String utm_term
String utm_content
String ref
String userId
String projectId
DateTime createdAt
DateTime updatedAt
}
Webhook {
String id
String projectId
String installationId
enum receiver
String name
String url
String secret
Json triggers
Int consecutiveFailures
DateTime lastFailedAt
DateTime disabledAt
DateTime createdAt
DateTime updatedAt
}
LinkWebhook {
String id
String linkId
String webhookId
}
Workflow {
String id
String programId
String name
enum trigger
Json triggerConditions
Json actions
DateTime disabledAt
DateTime createdAt
DateTime updatedAt
}
Project {
String id
String name
String slug
String logo
String inviteCode
String defaultProgramId
String plan
Int planTier
String stripeId
Int billingCycleStart
DateTime paymentFailedAt
String invoicePrefix
String stripeConnectId
String shopifyStoreId
Int totalLinks
Int totalClicks
Int usage
Int usageLimit
Int linksUsage
Int linksLimit
Int payoutsUsage
Int payoutsLimit
Float payoutFee
Int payoutFeeWaiverLimit
Int payoutFeeWaiverUsage
Int domainsLimit
Int tagsLimit
Int foldersUsage
Int foldersLimit
Int groupsLimit
Int usersLimit
Int aiUsage
Int aiLimit
Int networkInvitesLimit
String referralLinkId
Int referredSignups
Json store
Json allowedHostnames
String publishableKey
Boolean conversionEnabled
Boolean webhookEnabled
Boolean dotLinkClaimed
Boolean fastDirectDebitPayouts
String ssoEmailDomain
DateTime ssoEnforcedAt
DateTime createdAt
DateTime updatedAt
DateTime usageLastChecked
}
ProjectInvite {
String email
DateTime expires
String projectId
enum role
DateTime createdAt
}
ProjectUsers {
String id
enum role
String userId
String projectId
Json workspacePreferences
String defaultFolderId
DateTime createdAt
DateTime updatedAt
}
SentEmail {
String id
String type
DateTime createdAt
String projectId
}

Account ||--o{ User : relates_to
ActivityLog o|--o{ User : relates_to
BountyGroup ||--o{ Bounty : relates_to
BountySubmission o|--o{ User : relates_to
BountySubmission ||--o{ Bounty : relates_to
CampaignGroup ||--o{ Campaign : relates_to
Commission o|--o{ User : relates_to
Commission o|--o| BountySubmission : relates_to
Customer o{--o| Commission : relates_to
Dashboard o|--o{ User : relates_to
DiscountCode o|--o{ Discount : relates_to
Folder o|--o| Dashboard : relates_to
FolderAccessRequest ||--o{ Folder : relates_to
FolderAccessRequest ||--o{ User : relates_to
FolderUser ||--o{ Folder : relates_to
FolderUser ||--o{ User : relates_to
FraudEvent o|--o{ Customer : relates_to
FraudEvent ||--o{ FraudEventGroup : relates_to
FraudEventGroup o|--o{ User : relates_to
InstalledIntegration ||--o{ Integration : relates_to
InstalledIntegration ||--o{ User : relates_to
Integration o|--o{ User : relates_to
Link o{--o| Commission : relates_to
Link o{--o| Customer : relates_to
Link o{--o| FraudEvent : relates_to
Link o|--o{ Folder : relates_to
Link o|--o{ PartnerGroupDefaultLink : relates_to
Link o|--o{ User : relates_to
Link o|--o| Dashboard : relates_to
Link o|--|| DiscountCode : relates_to
Link ||--o{ Domain : relates_to
LinkTag ||--o{ Link : relates_to
LinkTag ||--o{ Tag : relates_to
LinkWebhook ||--o{ Link : relates_to
LinkWebhook ||--o{ Webhook : relates_to
Message ||--o{ User : relates_to
NotificationEmail o|--o{ Bounty : relates_to
NotificationEmail o|--o{ Campaign : relates_to
NotificationEmail o|--o{ Message : relates_to
OAuthApp o|--o| Integration : relates_to
OAuthCode ||--o{ OAuthApp : relates_to
OAuthCode ||--o{ User : relates_to
OAuthRefreshToken ||--o{ InstalledIntegration : relates_to
Partner o{--o| Customer : relates_to
Partner o{--o| Link : relates_to
Partner o{--o| NotificationEmail : relates_to
Partner o{--|| BountySubmission : relates_to
Partner o{--|| Commission : relates_to
Partner o{--|| DiscountCode : relates_to
Partner o{--|| DiscoveredPartner : relates_to
Partner o{--|| FraudEvent : relates_to
Partner o{--|| FraudEventGroup : relates_to
Partner o{--|| Message : relates_to
Partner o{--|| PartnerComment : relates_to
Partner o{--|| PartnerRewind : relates_to
PartnerComment ||--o{ User : relates_to
PartnerGroup o{--|| BountyGroup : relates_to
PartnerGroup o{--|| CampaignGroup : relates_to
PartnerGroup o|--o| Discount : relates_to
PartnerGroupDefaultLink ||--o{ PartnerGroup : relates_to
PartnerIndustryInterest ||--o{ Partner : relates_to
PartnerInvite ||--o{ Partner : relates_to
PartnerPlatform ||--o{ Partner : relates_to
PartnerPreferredEarningStructure ||--o{ Partner : relates_to
PartnerReferral o|--o{ Customer : relates_to
PartnerReferral ||--o{ Partner : relates_to
PartnerReferral ||--o{ Program : relates_to
PartnerReferral ||--o{ ProgramEnrollment : relates_to
PartnerSalesChannel ||--o{ Partner : relates_to
PartnerUser o|--|| PartnerNotificationPreferences : relates_to
PartnerUser ||--o{ Partner : relates_to
PartnerUser ||--o{ User : relates_to
Payout o{--o| Commission : relates_to
Payout o|--o{ Invoice : relates_to
Payout o|--o{ User : relates_to
Payout ||--o{ Partner : relates_to
Postback ||--o{ Partner : relates_to
Program o{--o| Customer : relates_to
Program o{--o| FraudEvent : relates_to
Program o{--o| FraudRule : relates_to
Program o{--o| Invoice : relates_to
Program o{--o| Link : relates_to
Program o{--|| Bounty : relates_to
Program o{--|| BountySubmission : relates_to
Program o{--|| Campaign : relates_to
Program o{--|| Commission : relates_to
Program o{--|| Discount : relates_to
Program o{--|| DiscountCode : relates_to
Program o{--|| DiscoveredPartner : relates_to
Program o{--|| EmailDomain : relates_to
Program o{--|| FraudEventGroup : relates_to
Program o{--|| Message : relates_to
Program o{--|| PartnerComment : relates_to
Program o{--|| PartnerGroup : relates_to
Program o{--|| PartnerGroupDefaultLink : relates_to
Program o{--|| Payout : relates_to
Program o{--|| ProgramCategory : relates_to
Program o{--|| ProgramSimilarity : relates_to
Program o|--o| Domain : relates_to
ProgramApplication o|--o{ PartnerGroup : relates_to
ProgramApplication o|--o{ User : relates_to
ProgramApplication o|--o| ProgramEnrollment : relates_to
ProgramApplication ||--o{ Program : relates_to
ProgramEnrollment o{--o| BountySubmission : relates_to
ProgramEnrollment o{--o| Customer : relates_to
ProgramEnrollment o{--o| DiscountCode : relates_to
ProgramEnrollment o{--o| Link : relates_to
ProgramEnrollment o{--|| Commission : relates_to
ProgramEnrollment o{--|| FraudEventGroup : relates_to
ProgramEnrollment o{--|| Message : relates_to
ProgramEnrollment o{--|| Payout : relates_to
ProgramEnrollment o|--o{ Discount : relates_to
ProgramEnrollment o|--o{ PartnerGroup : relates_to
ProgramEnrollment ||--o{ Partner : relates_to
ProgramEnrollment ||--o{ Program : relates_to
Project o{--o| Dashboard : relates_to
Project o{--o| Domain : relates_to
Project o{--o| Link : relates_to
Project o{--o| UtmTemplate : relates_to
Project o{--|| Customer : relates_to
Project o{--|| DefaultDomains : relates_to
Project o{--|| Folder : relates_to
Project o{--|| InstalledIntegration : relates_to
Project o{--|| Integration : relates_to
Project o{--|| Invoice : relates_to
Project o{--|| OAuthCode : relates_to
Project o{--|| Program : relates_to
Project o{--|| RegisteredDomain : relates_to
Project o{--|| RestrictedToken : relates_to
Project o{--|| Tag : relates_to
Project o{--|| Webhook : relates_to
Project o{--|| YearInReview : relates_to
ProjectInvite ||--o{ Project : relates_to
ProjectUsers o|--|| NotificationPreference : relates_to
ProjectUsers ||--o{ Project : relates_to
ProjectUsers ||--o{ User : relates_to
RegisteredDomain o|--o| Domain : relates_to
RestrictedToken o{--|| OAuthRefreshToken : relates_to
RestrictedToken o|--o{ InstalledIntegration : relates_to
RestrictedToken ||--o{ User : relates_to
Reward o{--o| Commission : relates_to
Reward o{--o| ProgramEnrollment : relates_to
Reward o|--o| PartnerGroup : relates_to
Reward ||--o{ Program : relates_to
SentEmail o|--o{ Project : relates_to
Session ||--o{ User : relates_to
Token ||--o{ User : relates_to
UserNotificationPreferences ||--o| User : relates_to
UtmTemplate o|--o{ User : relates_to
UtmTemplate o|--o| PartnerGroup : relates_to
Webhook o|--o{ InstalledIntegration : relates_to
Workflow o|--o| Bounty : relates_to
Workflow o|--o| Campaign : relates_to
Workflow o|--o| PartnerGroup : relates_to
Workflow ||--o{ Program : relates_to

```

```
