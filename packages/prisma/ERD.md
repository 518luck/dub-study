```mermaid
erDiagram

        BountyType {
            performance performance
submission submission
        }
    


        BountyPerformanceScope {
            new new
lifetime lifetime
        }
    


        BountySubmissionStatus {
            draft draft
submitted submitted
approved approved
rejected rejected
        }
    


        BountySubmissionRejectionReason {
            invalidProof invalidProof
duplicateSubmission duplicateSubmission
outOfTimeWindow outOfTimeWindow
didNotMeetCriteria didNotMeetCriteria
other other
        }
    


        BountySubmissionFrequency {
            day day
week week
month month
        }
    


        CampaignType {
            marketing marketing
transactional transactional
        }
    


        CampaignStatus {
            draft draft
active active
paused paused
scheduled scheduled
sending sending
sent sent
canceled canceled
        }
    


        CommissionStatus {
            pending pending
processed processed
paid paid
refunded refunded
duplicate duplicate
fraud fraud
canceled canceled
        }
    


        CommissionType {
            click click
lead lead
sale sale
custom custom
        }
    


        EmailDomainStatus {
            pending pending
verified verified
failed failed
temporary_failure temporary_failure
not_started not_started
        }
    


        FolderType {
            default default
mega mega
        }
    


        FolderAccessLevel {
            read read
write write
        }
    


        FolderUserRole {
            owner owner
editor editor
viewer viewer
        }
    


        FraudEventStatus {
            pending pending
resolved resolved
        }
    


        FraudRuleType {
            customerEmailMatch customerEmailMatch
customerEmailSuspiciousDomain customerEmailSuspiciousDomain
referralSourceBanned referralSourceBanned
paidTrafficDetected paidTrafficDetected
partnerCrossProgramBan partnerCrossProgramBan
partnerDuplicatePayoutMethod partnerDuplicatePayoutMethod
        }
    


        PartnerLinkStructure {
            short short
query query
path path
        }
    


        InvoiceStatus {
            processing processing
completed completed
failed failed
        }
    


        InvoiceType {
            partnerPayout partnerPayout
domainRenewal domainRenewal
        }
    


        PaymentMethod {
            card card
ach ach
ach_fast ach_fast
sepa sepa
acss acss
        }
    


        MessageType {
            direct direct
campaign campaign
        }
    


        Category {
            Artificial_Intelligence Artificial_Intelligence
Development Development
Design Design
Productivity Productivity
Finance Finance
Marketing Marketing
Ecommerce Ecommerce
Security Security
Education Education
Health Health
Consumer Consumer
        }
    


        IndustryInterest {
            SaaS SaaS
DevTool DevTool
AI AI
Creative_And_Design Creative_And_Design
Productivity_Software Productivity_Software
Marketing Marketing
Gaming Gaming
Finance Finance
Sales Sales
Ecommerce Ecommerce
Customer_Service_And_Support Customer_Service_And_Support
Content_Management Content_Management
Human_Resources Human_Resources
Security Security
Analytics_And_Data Analytics_And_Data
Social_Media Social_Media
Consumer_Tech Consumer_Tech
Education_And_Learning Education_And_Learning
Health_And_Fitness Health_And_Fitness
Food_And_Beverage Food_And_Beverage
Travel_And_Lifestyle Travel_And_Lifestyle
Entertainment_And_Media Entertainment_And_Media
Sports Sports
Science_And_Engineering Science_And_Engineering
        }
    


        NotificationEmailType {
            Message Message
Bounty Bounty
Campaign Campaign
        }
    


        PartnerRole {
            owner owner
member member
        }
    


        PartnerProfileType {
            individual individual
company company
        }
    


        MonthlyTraffic {
            ZeroToOneThousand ZeroToOneThousand
OneThousandToTenThousand OneThousandToTenThousand
TenThousandToFiftyThousand TenThousandToFiftyThousand
FiftyThousandToOneHundredThousand FiftyThousandToOneHundredThousand
OneHundredThousandPlus OneHundredThousandPlus
        }
    


        PartnerPayoutMethod {
            connect connect
stablecoin stablecoin
paypal paypal
        }
    


        PreferredEarningStructure {
            Revenue_Share Revenue_Share
Per_Lead Per_Lead
Per_Sale Per_Sale
Per_Click Per_Click
One_Time_Payment One_Time_Payment
        }
    


        SalesChannel {
            Blogs Blogs
Coupons Coupons
Direct_Reselling Direct_Reselling
Newsletters Newsletters
Social_Media Social_Media
Events Events
Company_Referrals Company_Referrals
        }
    


        PayoutStatus {
            pending pending
processing processing
processed processed
sent sent
completed completed
failed failed
canceled canceled
        }
    


        PayoutMode {
            internal internal
external external
        }
    


        PlatformType {
            website website
youtube youtube
twitter twitter
linkedin linkedin
instagram instagram
tiktok tiktok
        }
    


        PostbackReceiver {
            custom custom
slack slack
        }
    


        ProgramEnrollmentStatus {
            pending pending
approved approved
rejected rejected
invited invited
declined declined
deactivated deactivated
banned banned
archived archived
        }
    


        PartnerBannedReason {
            tos_violation tos_violation
inappropriate_content inappropriate_content
fake_traffic fake_traffic
fraud fraud
spam spam
brand_abuse brand_abuse
        }
    


        ProgramPayoutMode {
            internal internal
hybrid hybrid
external external
        }
    


        ProgramApplicationRejectionReason {
            needsMoreDetail needsMoreDetail
doesNotMeetRequirements doesNotMeetRequirements
notTheRightFit notTheRightFit
other other
        }
    


        ReferralStatus {
            pending pending
qualified qualified
meeting meeting
negotiation negotiation
unqualified unqualified
closedWon closedWon
closedLost closedLost
        }
    


        EventType {
            click click
lead lead
sale sale
        }
    


        RewardStructure {
            percentage percentage
flat flat
        }
    


        WebhookReceiver {
            user user
zapier zapier
make make
slack slack
segment segment
        }
    


        WorkflowTrigger {
            partnerEnrolled partnerEnrolled
partnerMetricsUpdated partnerMetricsUpdated
clickRecorded clickRecorded
commissionEarned commissionEarned
leadRecorded leadRecorded
saleRecorded saleRecorded
        }
    


        WorkspaceRole {
            owner owner
member member
viewer viewer
billing billing
        }
    
  "ActivityLog" {
    String id "🗝️"
    String workspaceId 
    String programId 
    String parentResourceType "❓"
    String parentResourceId "❓"
    String resourceType 
    String resourceId 
    String action 
    String description "❓"
    String batchId "❓"
    Json changeSet "❓"
    DateTime createdAt 
    }
  

  "Bounty" {
    String id "🗝️"
    String name 
    String description "❓"
    BountyType type 
    DateTime startsAt 
    DateTime endsAt "❓"
    DateTime submissionsOpenAt "❓"
    BountySubmissionFrequency submissionFrequency "❓"
    Int maxSubmissions 
    Int rewardAmount "❓"
    String rewardDescription "❓"
    BountyPerformanceScope performanceScope "❓"
    Json submissionRequirements "❓"
    DateTime socialMetricsLastSyncedAt "❓"
    DateTime archivedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "BountyGroup" {
    String id "🗝️"
    }
  

  "BountySubmission" {
    String id "🗝️"
    BigInt performanceCount "❓"
    Int socialMetricCount "❓"
    String description "❓"
    BountySubmissionStatus status 
    BountySubmissionRejectionReason rejectionReason "❓"
    String rejectionNote "❓"
    Json files "❓"
    Json urls "❓"
    Int periodNumber 
    DateTime socialMetricsLastSyncedAt "❓"
    DateTime completedAt "❓"
    DateTime reviewedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Campaign" {
    String id "🗝️"
    String userId 
    String qstashMessageId "❓"
    CampaignType type 
    CampaignStatus status 
    String name 
    String subject 
    String preview "❓"
    String from "❓"
    Json bodyJson 
    DateTime scheduledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "CampaignGroup" {
    String id "🗝️"
    }
  

  "PartnerComment" {
    String id "🗝️"
    String text 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Commission" {
    String id "🗝️"
    String invoiceId "❓"
    String eventId "❓"
    String description "❓"
    CommissionType type 
    Int amount 
    Int quantity 
    Int earnings 
    String currency 
    CommissionStatus status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Customer" {
    String id "🗝️"
    String name "❓"
    String email "❓"
    String avatar "❓"
    String externalId "❓"
    String stripeCustomerId "❓"
    String clickId "❓"
    DateTime clickedAt "❓"
    String country "❓"
    Int sales 
    BigInt saleAmount 
    DateTime firstSaleAt "❓"
    DateTime subscriptionCanceledAt "❓"
    String projectConnectId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Dashboard" {
    String id "🗝️"
    Boolean doIndex 
    String password "❓"
    Boolean showConversions 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Discount" {
    String id "🗝️"
    Int amount 
    RewardStructure type 
    Int maxDuration "❓"
    String description "❓"
    String couponId "❓"
    String couponTestId "❓"
    DateTime autoProvisionEnabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "DiscountCode" {
    String id "🗝️"
    String code 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Domain" {
    String id "🗝️"
    String slug 
    Boolean verified 
    String placeholder "❓"
    String expiredUrl "❓"
    String notFoundUrl "❓"
    Boolean primary 
    Boolean archived 
    DateTime lastChecked 
    String logo "❓"
    Json appleAppSiteAssociation "❓"
    Json assetLinks "❓"
    Json deepviewData "❓"
    Int linkRetentionDays "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "RegisteredDomain" {
    String id "🗝️"
    String slug 
    DateTime autoRenewalDisabledAt "❓"
    Int renewalFee 
    DateTime expiresAt 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "DefaultDomains" {
    String id "🗝️"
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
    }
  

  "EmailDomain" {
    String id "🗝️"
    String workspaceId 
    String slug 
    EmailDomainStatus status 
    String resendDomainId "❓"
    DateTime lastChecked 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Folder" {
    String id "🗝️"
    String name 
    String description "❓"
    FolderType type 
    FolderAccessLevel accessLevel "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "FolderUser" {
    String id "🗝️"
    FolderUserRole role "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "FolderAccessRequest" {
    String id "🗝️"
    DateTime createdAt 
    }
  

  "FraudRule" {
    String id "🗝️"
    FraudRuleType type 
    Json config "❓"
    DateTime disabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "FraudEventGroup" {
    String id "🗝️"
    FraudRuleType type 
    DateTime lastEventAt "❓"
    Int eventCount 
    String resolutionReason "❓"
    DateTime resolvedAt "❓"
    FraudEventStatus status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "FraudEvent" {
    String id "🗝️"
    String programId 
    String eventId "❓"
    String hash 
    Json metadata "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "PartnerGroup" {
    String id "🗝️"
    String name 
    String slug 
    String color "❓"
    PartnerLinkStructure linkStructure 
    Json additionalLinks "❓"
    Int maxPartnerLinks 
    Json applicationFormData "❓"
    DateTime applicationFormPublishedAt "❓"
    Json landerData "❓"
    DateTime landerPublishedAt "❓"
    String logo "❓"
    String wordmark "❓"
    String brandColor "❓"
    Int holdingPeriodDays 
    DateTime autoApprovePartnersEnabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "PartnerGroupDefaultLink" {
    String id "🗝️"
    String domain 
    String url 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Integration" {
    String id "🗝️"
    String name 
    String slug 
    String description "❓"
    String readme "❓"
    String developer 
    String website 
    String logo "❓"
    Json screenshots "❓"
    Boolean verified 
    String installUrl "❓"
    String guideUrl "❓"
    String category "❓"
    Boolean comingSoon 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "InstalledIntegration" {
    String id "🗝️"
    DateTime createdAt 
    DateTime updatedAt 
    Json credentials "❓"
    Json settings "❓"
    }
  

  "Invoice" {
    String id "🗝️"
    String number "❓"
    InvoiceStatus status 
    InvoiceType type 
    ProgramPayoutMode payoutMode 
    PaymentMethod paymentMethod "❓"
    Int amount 
    Int fee 
    Int total 
    Int externalAmount 
    String receiptUrl "❓"
    String failedReason "❓"
    Json registeredDomains "❓"
    Json stripeChargeMetadata "❓"
    Int failedAttempts 
    DateTime createdAt 
    DateTime paidAt "❓"
    }
  

  "jackson_index" {
    Int id "🗝️"
    String key 
    String storeKey 
    }
  

  "jackson_store" {
    String key "🗝️"
    String value 
    String iv "❓"
    String tag "❓"
    String namespace "❓"
    DateTime createdAt 
    DateTime modifiedAt "❓"
    }
  

  "jackson_ttl" {
    String key "🗝️"
    BigInt expiresAt 
    }
  

  "Link" {
    String id "🗝️"
    String key 
    String url 
    String shortLink 
    Boolean archived 
    DateTime expiresAt "❓"
    String expiredUrl "❓"
    DateTime disabledAt "❓"
    String password "❓"
    Boolean trackConversion 
    Boolean proxy 
    String title "❓"
    String description "❓"
    String image "❓"
    String video "❓"
    String utm_source "❓"
    String utm_medium "❓"
    String utm_campaign "❓"
    String utm_term "❓"
    String utm_content "❓"
    Boolean rewrite 
    DateTime linkRetentionCleanupDisabledAt "❓"
    Boolean doIndex 
    String ios "❓"
    String android "❓"
    Json geo "❓"
    Json testVariants "❓"
    DateTime testStartedAt "❓"
    DateTime testCompletedAt "❓"
    String externalId "❓"
    String tenantId "❓"
    Boolean publicStats 
    Int clicks 
    Int leads 
    Int conversions 
    Int sales 
    BigInt saleAmount 
    DateTime lastClicked "❓"
    DateTime lastLeadAt "❓"
    DateTime lastConversionAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    String comments "❓"
    }
  

  "Message" {
    String id "🗝️"
    MessageType type 
    String subject "❓"
    String text 
    DateTime readInApp "❓"
    DateTime readInEmail "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "YearInReview" {
    String id "🗝️"
    Int year 
    Int totalLinks 
    Int totalClicks 
    Json topLinks 
    Json topCountries 
    DateTime createdAt 
    DateTime sentAt "❓"
    }
  

  "PartnerRewind" {
    String id "🗝️"
    Int year 
    Int totalClicks 
    Int totalLeads 
    Int totalRevenue 
    Int totalEarnings 
    DateTime createdAt 
    DateTime sentAt "❓"
    }
  

  "ProgramCategory" {
    Category category 
    }
  

  "ProgramSimilarity" {
    String id "🗝️"
    Float similarityScore 
    Float categorySimilarityScore 
    Float partnerSimilarityScore 
    Float performanceSimilarityScore 
    }
  

  "DiscoveredPartner" {
    String id "🗝️"
    DateTime starredAt "❓"
    DateTime ignoredAt "❓"
    DateTime invitedAt "❓"
    DateTime messagedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "NotificationEmail" {
    String id "🗝️"
    String emailId 
    NotificationEmailType type 
    String programId "❓"
    String recipientUserId "❓"
    DateTime deliveredAt "❓"
    DateTime openedAt "❓"
    DateTime bouncedAt "❓"
    DateTime createdAt 
    }
  

  "UserNotificationPreferences" {
    String id "🗝️"
    Boolean dubLinks 
    Boolean dubPartners 
    Boolean partnerAccount 
    }
  

  "NotificationPreference" {
    String id "🗝️"
    Boolean linkUsageSummary 
    Boolean domainConfigurationUpdates 
    Boolean newPartnerSale 
    Boolean newPartnerApplication 
    Boolean pendingApplicationsSummary 
    Boolean newBountySubmitted 
    Boolean newMessageFromPartner 
    Boolean fraudEventsSummary 
    }
  

  "PartnerNotificationPreferences" {
    String id "🗝️"
    Boolean commissionCreated 
    Boolean applicationApproved 
    Boolean newMessageFromProgram 
    Boolean marketingCampaign 
    Boolean connectPayoutReminder 
    }
  

  "OAuthApp" {
    String id "🗝️"
    String clientId 
    String hashedClientSecret 
    String partialClientSecret 
    Json redirectUris 
    Boolean pkce 
    }
  

  "OAuthCode" {
    String id "🗝️"
    String code 
    String scopes "❓"
    String redirectUri 
    String codeChallenge "❓"
    String codeChallengeMethod "❓"
    DateTime expiresAt 
    DateTime createdAt 
    }
  

  "OAuthRefreshToken" {
    String id "🗝️"
    String hashedRefreshToken 
    DateTime expiresAt 
    DateTime createdAt 
    }
  

  "Partner" {
    String id "🗝️"
    String name 
    String companyName "❓"
    PartnerProfileType profileType 
    String email "❓"
    String image "❓"
    String description "❓"
    String country "❓"
    PartnerPayoutMethod defaultPayoutMethod "❓"
    DateTime payoutsEnabledAt "❓"
    DateTime connectPayoutsLastRemindedAt "❓"
    String paypalEmail "❓"
    String stripeConnectId "❓"
    String stripeRecipientId "❓"
    String payoutMethodHash "❓"
    String cryptoWalletAddress "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime discoverableAt "❓"
    DateTime trustedAt "❓"
    Json invoiceSettings "❓"
    Json changeHistoryLog "❓"
    MonthlyTraffic monthlyTraffic "❓"
    }
  

  "PartnerInvite" {
    String email 
    DateTime expires 
    PartnerRole role 
    DateTime createdAt 
    }
  

  "PartnerUser" {
    String id "🗝️"
    PartnerRole role 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "PartnerIndustryInterest" {
    IndustryInterest industryInterest 
    }
  

  "PartnerPreferredEarningStructure" {
    PreferredEarningStructure preferredEarningStructure 
    }
  

  "PartnerSalesChannel" {
    SalesChannel salesChannel 
    }
  

  "Payout" {
    String id "🗝️"
    Int amount 
    String currency 
    PayoutStatus status 
    PayoutMode mode "❓"
    PartnerPayoutMethod method "❓"
    String description "❓"
    DateTime periodStart "❓"
    DateTime periodEnd "❓"
    String paypalTransferId "❓"
    String stripeTransferId "❓"
    String stripePayoutId "❓"
    String stripePayoutTraceId "❓"
    String failureReason "❓"
    String webhookEventId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime initiatedAt "❓"
    DateTime paidAt "❓"
    }
  

  "PartnerPlatform" {
    String id "🗝️"
    PlatformType type 
    String identifier 
    String platformId "❓"
    String avatarUrl "❓"
    BigInt subscribers 
    BigInt posts 
    BigInt views 
    Json metadata "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime verifiedAt "❓"
    DateTime lastCheckedAt "❓"
    }
  

  "Postback" {
    String id "🗝️"
    String name 
    String url 
    String secret 
    Json triggers 
    PostbackReceiver receiver 
    DateTime disabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Program" {
    String id "🗝️"
    String defaultFolderId 
    String defaultGroupId 
    String name 
    String slug 
    String url "❓"
    String logo "❓"
    String description "❓"
    EventType primaryRewardEvent 
    Int minPayoutAmount 
    ProgramPayoutMode payoutMode 
    Json inviteEmailData "❓"
    Json embedData "❓"
    Json resources "❓"
    Json referralFormData "❓"
    Json applicationRequirements "❓"
    String termsUrl "❓"
    String helpUrl "❓"
    String supportEmail "❓"
    DateTime messagingEnabledAt "❓"
    DateTime partnerNetworkEnabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime startedAt "❓"
    DateTime deactivatedAt "❓"
    DateTime addedToMarketplaceAt "❓"
    DateTime featuredOnMarketplaceAt "❓"
    String marketplaceHeaderImage "❓"
    Int marketplaceRanking 
    }
  

  "ProgramEnrollment" {
    String id "🗝️"
    String tenantId "❓"
    ProgramEnrollmentStatus status 
    Int totalClicks 
    Int totalLeads 
    Int totalConversions 
    Int totalSales 
    BigInt totalSaleAmount 
    BigInt totalCommissions 
    BigInt netRevenue 
    Float earningsPerClick 
    Float averageLifetimeValue "❓"
    Float clickToLeadRate "❓"
    Float clickToConversionRate "❓"
    Float leadToConversionRate "❓"
    Float returnOnAdSpend "❓"
    DateTime lastConversionAt "❓"
    Int daysSinceLastConversion "❓"
    Int consistencyScore "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime customerDataSharingEnabledAt "❓"
    DateTime groupMoveDisabledAt "❓"
    DateTime bannedAt "❓"
    PartnerBannedReason bannedReason "❓"
    }
  

  "ProgramApplication" {
    String id "🗝️"
    String name 
    String email 
    String country "❓"
    String website "❓"
    String youtube "❓"
    String twitter "❓"
    String linkedin "❓"
    String instagram "❓"
    String tiktok "❓"
    Json formData "❓"
    ProgramApplicationRejectionReason rejectionReason "❓"
    String rejectionNote "❓"
    DateTime reviewedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "PartnerReferral" {
    String id "🗝️"
    String name 
    String email 
    String company 
    Json formData "❓"
    ReferralStatus status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Reward" {
    String id "🗝️"
    String description "❓"
    String tooltipDescription "❓"
    EventType event 
    RewardStructure type 
    Int amountInCents "❓"
    Decimal amountInPercentage "❓"
    Int maxDuration "❓"
    Json modifiers "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "User" {
    String id "🗝️"
    String name "❓"
    String email "❓"
    DateTime emailVerified "❓"
    String image "❓"
    Boolean isMachine 
    DateTime createdAt 
    String passwordHash "❓"
    Int invalidLoginAttempts 
    DateTime lockedAt "❓"
    String defaultWorkspace "❓"
    String defaultPartnerId "❓"
    String source "❓"
    Boolean sentMail 
    }
  

  "Account" {
    String id "🗝️"
    String type 
    String provider 
    String providerAccountId 
    String refresh_token "❓"
    Int refresh_token_expires_in "❓"
    String access_token "❓"
    Int expires_at "❓"
    String token_type "❓"
    String scope "❓"
    String id_token "❓"
    String session_state "❓"
    }
  

  "Session" {
    String id "🗝️"
    String sessionToken 
    DateTime expires 
    }
  

  "Tag" {
    String id "🗝️"
    String name 
    String color 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "LinkTag" {
    String id "🗝️"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Token" {
    String id "🗝️"
    String name 
    String hashedKey 
    String partialKey 
    DateTime expires "❓"
    DateTime lastUsed "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "RestrictedToken" {
    String id "🗝️"
    String name 
    String hashedKey 
    String partialKey 
    String scopes "❓"
    DateTime expires "❓"
    DateTime lastUsed "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "VerificationToken" {
    String identifier 
    String token 
    DateTime expires 
    }
  

  "EmailVerificationToken" {
    String identifier 
    String token 
    DateTime expires 
    }
  

  "PasswordResetToken" {
    String identifier 
    String token 
    DateTime expires 
    }
  

  "UtmTemplate" {
    String id "🗝️"
    String name 
    String utm_source "❓"
    String utm_medium "❓"
    String utm_campaign "❓"
    String utm_term "❓"
    String utm_content "❓"
    String ref "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Webhook" {
    String id "🗝️"
    WebhookReceiver receiver 
    String name 
    String url 
    String secret 
    Json triggers 
    Int consecutiveFailures 
    DateTime lastFailedAt "❓"
    DateTime disabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "LinkWebhook" {
    String id "🗝️"
    }
  

  "Workflow" {
    String id "🗝️"
    String name "❓"
    WorkflowTrigger trigger 
    Json triggerConditions 
    Json actions 
    DateTime disabledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Project" {
    String id "🗝️"
    String name 
    String slug 
    String logo "❓"
    String inviteCode "❓"
    String defaultProgramId "❓"
    String plan 
    Int planTier 
    String stripeId "❓"
    Int billingCycleStart 
    DateTime paymentFailedAt "❓"
    String invoicePrefix "❓"
    String stripeConnectId "❓"
    String shopifyStoreId "❓"
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
    String referralLinkId "❓"
    Int referredSignups 
    Json store "❓"
    Json allowedHostnames "❓"
    String publishableKey "❓"
    Boolean conversionEnabled 
    Boolean webhookEnabled 
    Boolean dotLinkClaimed 
    Boolean fastDirectDebitPayouts 
    String ssoEmailDomain "❓"
    DateTime ssoEnforcedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime usageLastChecked 
    }
  

  "ProjectInvite" {
    String email 
    DateTime expires 
    WorkspaceRole role 
    DateTime createdAt 
    }
  

  "ProjectUsers" {
    String id "🗝️"
    WorkspaceRole role 
    Json workspacePreferences "❓"
    String defaultFolderId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "SentEmail" {
    String id "🗝️"
    String type 
    DateTime createdAt 
    }
  
    "ActivityLog" }o--|o "User" : "user"
    "Bounty" |o--|| "BountyType" : "enum:type"
    "Bounty" |o--|o "BountySubmissionFrequency" : "enum:submissionFrequency"
    "Bounty" |o--|o "BountyPerformanceScope" : "enum:performanceScope"
    "Bounty" }o--|| "Program" : "program"
    "Bounty" |o--|o "Workflow" : "workflow"
    "BountyGroup" }o--|| "Bounty" : "bounty"
    "BountyGroup" }o--|| "PartnerGroup" : "partnerGroup"
    "BountySubmission" |o--|| "BountySubmissionStatus" : "enum:status"
    "BountySubmission" |o--|o "BountySubmissionRejectionReason" : "enum:rejectionReason"
    "BountySubmission" }o--|| "Bounty" : "bounty"
    "BountySubmission" }o--|| "Partner" : "partner"
    "BountySubmission" |o--|o "Commission" : "commission"
    "BountySubmission" }o--|| "Program" : "program"
    "BountySubmission" }o--|o "User" : "user"
    "BountySubmission" }o--|o "ProgramEnrollment" : "programEnrollment"
    "Campaign" |o--|| "CampaignType" : "enum:type"
    "Campaign" |o--|| "CampaignStatus" : "enum:status"
    "Campaign" }o--|| "Program" : "program"
    "Campaign" |o--|o "Workflow" : "workflow"
    "CampaignGroup" }o--|| "Campaign" : "campaign"
    "CampaignGroup" }o--|| "PartnerGroup" : "partnerGroup"
    "PartnerComment" }o--|| "Program" : "program"
    "PartnerComment" }o--|| "Partner" : "partner"
    "PartnerComment" }o--|| "User" : "user"
    "Commission" |o--|| "CommissionType" : "enum:type"
    "Commission" |o--|| "CommissionStatus" : "enum:status"
    "Commission" }o--|| "Program" : "program"
    "Commission" }o--|| "Partner" : "partner"
    "Commission" }o--|| "ProgramEnrollment" : "programEnrollment"
    "Commission" }o--|o "Payout" : "payout"
    "Commission" }o--|o "Link" : "link"
    "Commission" }o--|o "Customer" : "customer"
    "Commission" }o--|o "Reward" : "reward"
    "Commission" }o--|o "User" : "user"
    "Customer" }o--|| "Project" : "project"
    "Customer" }o--|o "Link" : "link"
    "Customer" }o--|o "Program" : "program"
    "Customer" }o--|o "Partner" : "partner"
    "Customer" }o--|o "ProgramEnrollment" : "programEnrollment"
    "Dashboard" |o--|o "Link" : "link"
    "Dashboard" |o--|o "Folder" : "folder"
    "Dashboard" }o--|o "Project" : "project"
    "Dashboard" }o--|o "User" : "user"
    "Discount" |o--|| "RewardStructure" : "enum:type"
    "Discount" }o--|| "Program" : "program"
    "DiscountCode" }o--|| "Program" : "program"
    "DiscountCode" }o--|o "Discount" : "discount"
    "DiscountCode" }o--|| "Partner" : "partner"
    "DiscountCode" |o--|| "Link" : "link"
    "DiscountCode" }o--|o "ProgramEnrollment" : "programEnrollment"
    "Domain" }o--|o "Project" : "project"
    "RegisteredDomain" }o--|| "Project" : "project"
    "RegisteredDomain" |o--|o "Domain" : "domain"
    "DefaultDomains" }o--|| "Project" : "project"
    "EmailDomain" |o--|| "EmailDomainStatus" : "enum:status"
    "EmailDomain" }o--|| "Program" : "program"
    "Folder" |o--|| "FolderType" : "enum:type"
    "Folder" |o--|o "FolderAccessLevel" : "enum:accessLevel"
    "Folder" }o--|| "Project" : "project"
    "FolderUser" |o--|o "FolderUserRole" : "enum:role"
    "FolderUser" }o--|| "Folder" : "folder"
    "FolderUser" }o--|| "User" : "user"
    "FolderAccessRequest" }o--|| "Folder" : "folder"
    "FolderAccessRequest" }o--|| "User" : "user"
    "FraudRule" |o--|| "FraudRuleType" : "enum:type"
    "FraudRule" }o--|o "Program" : "program"
    "FraudEventGroup" |o--|| "FraudRuleType" : "enum:type"
    "FraudEventGroup" |o--|| "FraudEventStatus" : "enum:status"
    "FraudEventGroup" }o--|| "Program" : "program"
    "FraudEventGroup" }o--|| "Partner" : "partner"
    "FraudEventGroup" }o--|| "ProgramEnrollment" : "programEnrollment"
    "FraudEventGroup" }o--|o "User" : "user"
    "FraudEvent" }o--|| "FraudEventGroup" : "fraudEventGroup"
    "FraudEvent" }o--|| "Partner" : "partner"
    "FraudEvent" }o--|o "Customer" : "customer"
    "FraudEvent" }o--|o "Link" : "link"
    "FraudEvent" }o--|o "Program" : "sourceProgram"
    "PartnerGroup" |o--|| "PartnerLinkStructure" : "enum:linkStructure"
    "PartnerGroup" }o--|| "Program" : "program"
    "PartnerGroup" |o--|o "Reward" : "clickReward"
    "PartnerGroup" |o--|o "Reward" : "leadReward"
    "PartnerGroup" |o--|o "Reward" : "saleReward"
    "PartnerGroup" |o--|o "Discount" : "discount"
    "PartnerGroup" |o--|o "Workflow" : "workflow"
    "PartnerGroup" |o--|o "UtmTemplate" : "utmTemplate"
    "PartnerGroupDefaultLink" }o--|| "Program" : "program"
    "PartnerGroupDefaultLink" }o--|| "PartnerGroup" : "partnerGroup"
    "Integration" }o--|o "User" : "user"
    "Integration" }o--|| "Project" : "project"
    "InstalledIntegration" }o--|| "User" : "user"
    "InstalledIntegration" }o--|| "Integration" : "integration"
    "InstalledIntegration" }o--|| "Project" : "project"
    "Invoice" |o--|| "InvoiceStatus" : "enum:status"
    "Invoice" |o--|| "InvoiceType" : "enum:type"
    "Invoice" |o--|| "ProgramPayoutMode" : "enum:payoutMode"
    "Invoice" |o--|o "PaymentMethod" : "enum:paymentMethod"
    "Invoice" }o--|o "Program" : "program"
    "Invoice" }o--|| "Project" : "workspace"
    "Link" }o--|o "User" : "user"
    "Link" }o--|o "Project" : "project"
    "Link" }o--|o "Folder" : "folder"
    "Link" }o--|| "Domain" : "shortDomain"
    "Link" }o--|o "Program" : "program"
    "Link" }o--|o "Partner" : "partner"
    "Link" }o--|o "ProgramEnrollment" : "programEnrollment"
    "Link" }o--|o "PartnerGroupDefaultLink" : "partnerGroupDefaultLink"
    "Message" |o--|| "MessageType" : "enum:type"
    "Message" }o--|| "Program" : "program"
    "Message" }o--|| "Partner" : "partner"
    "Message" }o--|| "ProgramEnrollment" : "programEnrollment"
    "Message" }o--|| "User" : "senderUser"
    "Message" }o--|o "Partner" : "senderPartner"
    "YearInReview" }o--|| "Project" : "workspace"
    "PartnerRewind" }o--|| "Partner" : "partner"
    "ProgramCategory" |o--|| "Category" : "enum:category"
    "ProgramCategory" }o--|| "Program" : "program"
    "ProgramSimilarity" }o--|| "Program" : "program"
    "ProgramSimilarity" }o--|| "Program" : "similarProgram"
    "DiscoveredPartner" }o--|| "Program" : "program"
    "DiscoveredPartner" }o--|| "Partner" : "partner"
    "NotificationEmail" |o--|| "NotificationEmailType" : "enum:type"
    "NotificationEmail" }o--|o "Message" : "message"
    "NotificationEmail" }o--|o "Bounty" : "bounty"
    "NotificationEmail" }o--|o "Campaign" : "campaign"
    "NotificationEmail" }o--|o "Partner" : "partner"
    "UserNotificationPreferences" |o--|| "User" : "user"
    "NotificationPreference" |o--|| "ProjectUsers" : "projectUser"
    "PartnerNotificationPreferences" |o--|| "PartnerUser" : "partnerUser"
    "OAuthApp" |o--|o "Integration" : "integration"
    "OAuthCode" }o--|| "OAuthApp" : "oAuthApp"
    "OAuthCode" }o--|| "User" : "user"
    "OAuthCode" }o--|| "Project" : "project"
    "OAuthRefreshToken" }o--|| "RestrictedToken" : "accessToken"
    "OAuthRefreshToken" }o--|| "InstalledIntegration" : "installedIntegration"
    "Partner" |o--|| "PartnerProfileType" : "enum:profileType"
    "Partner" |o--|o "PartnerPayoutMethod" : "enum:defaultPayoutMethod"
    "Partner" |o--|o "MonthlyTraffic" : "enum:monthlyTraffic"
    "PartnerInvite" |o--|| "PartnerRole" : "enum:role"
    "PartnerInvite" }o--|| "Partner" : "partner"
    "PartnerUser" |o--|| "PartnerRole" : "enum:role"
    "PartnerUser" }o--|| "User" : "user"
    "PartnerUser" }o--|| "Partner" : "partner"
    "PartnerIndustryInterest" |o--|| "IndustryInterest" : "enum:industryInterest"
    "PartnerIndustryInterest" }o--|| "Partner" : "partner"
    "PartnerPreferredEarningStructure" |o--|| "PreferredEarningStructure" : "enum:preferredEarningStructure"
    "PartnerPreferredEarningStructure" }o--|| "Partner" : "partner"
    "PartnerSalesChannel" |o--|| "SalesChannel" : "enum:salesChannel"
    "PartnerSalesChannel" }o--|| "Partner" : "partner"
    "Payout" |o--|| "PayoutStatus" : "enum:status"
    "Payout" |o--|o "PayoutMode" : "enum:mode"
    "Payout" |o--|o "PartnerPayoutMethod" : "enum:method"
    "Payout" }o--|| "Program" : "program"
    "Payout" }o--|| "Partner" : "partner"
    "Payout" }o--|| "ProgramEnrollment" : "programEnrollment"
    "Payout" }o--|o "Invoice" : "invoice"
    "Payout" }o--|o "User" : "user"
    "PartnerPlatform" |o--|| "PlatformType" : "enum:type"
    "PartnerPlatform" }o--|| "Partner" : "partner"
    "Postback" |o--|| "PostbackReceiver" : "enum:receiver"
    "Postback" }o--|| "Partner" : "partner"
    "Program" |o--|| "EventType" : "enum:primaryRewardEvent"
    "Program" |o--|| "ProgramPayoutMode" : "enum:payoutMode"
    "Program" }o--|| "Project" : "workspace"
    "Program" |o--|o "Domain" : "customDomain"
    "ProgramEnrollment" |o--|| "ProgramEnrollmentStatus" : "enum:status"
    "ProgramEnrollment" |o--|o "PartnerBannedReason" : "enum:bannedReason"
    "ProgramEnrollment" }o--|| "Partner" : "partner"
    "ProgramEnrollment" }o--|| "Program" : "program"
    "ProgramEnrollment" }o--|o "PartnerGroup" : "partnerGroup"
    "ProgramEnrollment" |o--|o "ProgramApplication" : "application"
    "ProgramEnrollment" }o--|o "Reward" : "clickReward"
    "ProgramEnrollment" }o--|o "Reward" : "leadReward"
    "ProgramEnrollment" }o--|o "Reward" : "saleReward"
    "ProgramEnrollment" }o--|o "Discount" : "discount"
    "ProgramApplication" |o--|o "ProgramApplicationRejectionReason" : "enum:rejectionReason"
    "ProgramApplication" }o--|| "Program" : "program"
    "ProgramApplication" }o--|o "PartnerGroup" : "partnerGroup"
    "ProgramApplication" }o--|o "User" : "user"
    "PartnerReferral" |o--|| "ReferralStatus" : "enum:status"
    "PartnerReferral" }o--|| "Program" : "program"
    "PartnerReferral" }o--|| "Partner" : "partner"
    "PartnerReferral" }o--|| "ProgramEnrollment" : "programEnrollment"
    "PartnerReferral" }o--|o "Customer" : "customer"
    "Reward" |o--|| "EventType" : "enum:event"
    "Reward" |o--|| "RewardStructure" : "enum:type"
    "Reward" }o--|| "Program" : "program"
    "Account" }o--|| "User" : "user"
    "Session" }o--|| "User" : "user"
    "Tag" }o--|| "Project" : "project"
    "LinkTag" }o--|| "Link" : "link"
    "LinkTag" }o--|| "Tag" : "tag"
    "Token" }o--|| "User" : "user"
    "RestrictedToken" }o--|| "User" : "user"
    "RestrictedToken" }o--|| "Project" : "project"
    "RestrictedToken" }o--|o "InstalledIntegration" : "installedIntegration"
    "UtmTemplate" }o--|o "User" : "user"
    "UtmTemplate" }o--|o "Project" : "project"
    "Webhook" |o--|| "WebhookReceiver" : "enum:receiver"
    "Webhook" }o--|| "Project" : "project"
    "Webhook" }o--|o "InstalledIntegration" : "installedIntegration"
    "LinkWebhook" }o--|| "Link" : "link"
    "LinkWebhook" }o--|| "Webhook" : "webhook"
    "Workflow" |o--|| "WorkflowTrigger" : "enum:trigger"
    "Workflow" }o--|| "Program" : "program"
    "ProjectInvite" }o--|| "Project" : "project"
    "ProjectInvite" |o--|| "WorkspaceRole" : "enum:role"
    "ProjectUsers" |o--|| "WorkspaceRole" : "enum:role"
    "ProjectUsers" }o--|| "User" : "user"
    "ProjectUsers" }o--|| "Project" : "project"
    "SentEmail" }o--|o "Project" : "project"
```
