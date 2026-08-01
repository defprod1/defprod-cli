import { z } from 'zod';

export enum CaseName {

    // Address
    getAddressLookup = 'getAddressLookup',

    // Admin
    checkUserConsistency = 'checkUserConsistency',
    checkAllUsersConsistency = 'checkAllUsersConsistency',
    getAdminConfig = 'getAdminConfig',
    patchAdminConfig = 'patchAdminConfig',
    listMcpTools = 'listMcpTools',
    listCliTools = 'listCliTools',
    createAllSoldProducts = 'createAllSoldProducts',
    createSoldProduct = 'createSoldProduct',
    getLogLevel = 'getLogLevel',
    setLogLevel = 'setLogLevel',
    getApiInfo = 'getApiInfo',
    generateDocs = 'generateDocs',
    listEvents = 'listEvents',
    listEventsAdmin = 'listEventsAdmin',
    getUsersAdmin = 'getUsersAdmin',
    getUserDetail = 'getUserDetail',
    deleteUser = 'deleteUser',
    disableUser = 'disableUser',
    enableUser = 'enableUser',
    listUsers = 'listUsers',
    migrateProductsToTeams = 'migrateProductsToTeams',
    listGenAiSessionsAdmin = 'listGenAiSessionsAdmin',
    getGenAiSessionDetailAdmin = 'getGenAiSessionDetailAdmin',
    listSignupCasesAdmin = 'listSignupCasesAdmin',
    getSignupCaseAdmin = 'getSignupCaseAdmin',
    patchSignupCaseAdmin = 'patchSignupCaseAdmin',
    createIncident = 'createIncident',
    listIncidents = 'listIncidents',
    getIncident = 'getIncident',
    patchIncident = 'patchIncident',
    listClientEvents = 'listClientEvents',
    getClientEvent = 'getClientEvent',
    broadcastClientReload = 'broadcastClientReload',

    // Agent
    listAgents = 'listAgents',
    getAgent = 'getAgent',
    createAgent = 'createAgent',
    updateAgent = 'updateAgent',
    deleteAgent = 'deleteAgent',
    startDefinitionGenAiSession = 'startDefinitionGenAiSession',
    continueDefinitionGenAiSession = 'continueDefinitionGenAiSession',
    deleteDefinitionGenAiSession = 'deleteDefinitionGenAiSession',
    generateDirectionReport = 'generateDirectionReport',
    generateDeliveryReport = 'generateDeliveryReport',
    getProductReports = 'getProductReports',
    getProductReportHistory = 'getProductReportHistory',
    applyReportActions = 'applyReportActions',
    generateMarketReport = 'generateMarketReport',
    getMarketReportHistory = 'getMarketReportHistory',
    generateChangeReport = 'generateChangeReport',
    getChangeReportHistory = 'getChangeReportHistory',

    // Change (product-scoped change records — the lifecycle entity; distinct
    // from the agent-generated change REPORTS directly above)
    createChange = 'createChange',
    listChanges = 'listChanges',
    getChange = 'getChange',
    patchChange = 'patchChange',
    startChangeStage = 'startChangeStage',
    finishChangeStage = 'finishChangeStage',
    cancelChangeStage = 'cancelChangeStage',
    cancelChange = 'cancelChange',
    reopenChange = 'reopenChange',
    getEffectiveChangePipeline = 'getEffectiveChangePipeline',
    setChangeStageTimes = 'setChangeStageTimes',
    deleteChange = 'deleteChange',

    // CdRun (team-scoped CD deploy-run telemetry — reported by the pipeline,
    // read-only in the app; observation, never control)
    startCdRun = 'startCdRun',
    finishCdRun = 'finishCdRun',
    reportCdRunStage = 'reportCdRunStage',
    getCdRun = 'getCdRun',
    listCdRuns = 'listCdRuns',

    // Release (per-product production-ship artifact; minted by the server on a
    // successful production finishCdRun, notes editable via patchRelease)
    getRelease = 'getRelease',
    listReleases = 'listReleases',
    patchRelease = 'patchRelease',

    // Analytics
    logPaymentError = 'logPaymentError',
    listPaymentErrorAnalytics = 'listPaymentErrorAnalytics',
    getConcurrentUsersMetrics = 'getConcurrentUsersMetrics',
    getDbSizeMetrics = 'getDbSizeMetrics',
    sampleDbSizeNow = 'sampleDbSizeNow',
    getAnalyticsOverview = 'getAnalyticsOverview',
    getAnalyticsFunnels = 'getAnalyticsFunnels',
    getAnalyticsTrafficSources = 'getAnalyticsTrafficSources',
    trackPricingPageViewed = 'trackPricingPageViewed',

    // Architecture
    getArchitecture = 'getArchitecture',
    getArchitectureForProduct = 'getArchitectureForProduct',
    listArchitectures = 'listArchitectures',
    createArchitecture = 'createArchitecture',
    updateArchitecture = 'updateArchitecture',
    deleteArchitecture = 'deleteArchitecture',
    getArchitectureElement = 'getArchitectureElement',
    listArchitectureElements = 'listArchitectureElements',
    createArchitectureElement = 'createArchitectureElement',
    updateArchitectureElement = 'updateArchitectureElement',
    patchArchitectureElement = 'patchArchitectureElement',
    deleteArchitectureElement = 'deleteArchitectureElement',
    moveArchitectureElement = 'moveArchitectureElement',
    getArchitectureTree = 'getArchitectureTree',
    // Architecture relationships are currently unused - will possibly be removed in the future
    getArchitectureRelationship = 'getArchitectureRelationship',
    listArchitectureRelationships = 'listArchitectureRelationships',
    createArchitectureRelationship = 'createArchitectureRelationship',
    updateArchitectureRelationship = 'updateArchitectureRelationship',
    deleteArchitectureRelationship = 'deleteArchitectureRelationship',

    // Area
    patchArea = 'patchArea',
    listAllAreas = 'listAllAreas',
    listAreas = 'listAreas',
    getArea = 'getArea',
    createArea = 'createArea',
    updateArea = 'updateArea',
    deleteArea = 'deleteArea',
    reorderAreas = 'reorderAreas',

    // Brief
    patchBrief = 'patchBrief',
    listBriefs = 'listBriefs',
    getBrief = 'getBrief',
    getBriefForProduct = 'getBriefForProduct',
    createBrief = 'createBrief',
    updateBrief = 'updateBrief',
    deleteBrief = 'deleteBrief',

    // Event
    listPaymentFailureEvents = 'listPaymentFailureEvents',
    listPaymentFailureStatistics = 'listPaymentFailureStatistics',

    // Feature
    listUserEntitlements = 'listUserEntitlements',
    checkFeatureAvailability = 'checkFeatureAvailability',
    getFeatureUsage = 'getFeatureUsage',
    getFeatureLimitNotifications = 'getFeatureLimitNotifications',

    // Feature Flags (release-readiness gating)
    getClientConfig = 'getClientConfig',
    listFeatureFlags = 'listFeatureFlags',
    setFeatureFlag = 'setFeatureFlag',

    // Feedback
    submitAppFeedback = 'submitAppFeedback',
    submitWebFeedback = 'submitWebFeedback',
    listFeedback = 'listFeedback',
    getFeedback = 'getFeedback',

    // Genai
    genaiQueryWithoutSession = 'genaiQueryWithoutSession',
    getLatestDefinitionGenAiSessionForProduct = 'getLatestDefinitionGenAiSessionForProduct',

    // Payment
    createStoredCardPayment = 'createStoredCardPayment',
    listUserPayments = 'listUserPayments',
    createPayment = 'createPayment',
    setDefaultPaymentMethod = 'setDefaultPaymentMethod',
    removePaymentMethod = 'removePaymentMethod',
    getPaymentMethod = 'getPaymentMethod',
    listPaymentMethods = 'listPaymentMethods',

    // Plan
    deleteAllPlans = 'deleteAllPlans',
    listPlans = 'listPlans',
    listPlansAdmin = 'listPlansAdmin',
    getPlan = 'getPlan',
    getPlanAdmin = 'getPlanAdmin',
    createPlan = 'createPlan',
    updatePlan = 'updatePlan',
    deletePlan = 'deletePlan',
    createDefaultPlans = 'createDefaultPlans',
    syncAllPlansToStripe = 'syncAllPlansToStripe',
    syncPlanFeatures = 'syncPlanFeatures',

    // PlanPrice (PAY-55..59)
    createPlanPriceDraft = 'createPlanPriceDraft',
    updatePlanPriceDraft = 'updatePlanPriceDraft',
    discardPlanPriceDraft = 'discardPlanPriceDraft',
    previewPlanPriceChange = 'previewPlanPriceChange',
    schedulePlanPriceChange = 'schedulePlanPriceChange',
    publishPlanPriceChange = 'publishPlanPriceChange',
    listPlanPrices = 'listPlanPrices',
    getPlanPrice = 'getPlanPrice',
    forceApplyPendingPlanPriceMigration = 'forceApplyPendingPlanPriceMigration',
    previewSubscriptionPriceMove = 'previewSubscriptionPriceMove',
    moveSubscriptionToCurrentPlanPrice = 'moveSubscriptionToCurrentPlanPrice',
    cancelPendingSubscriptionPriceMove = 'cancelPendingSubscriptionPriceMove',
    applyPendingPlanPriceMigrations = 'applyPendingPlanPriceMigrations',
    processScheduledPlanPricePublishes = 'processScheduledPlanPricePublishes',
    sendPlanPriceChangeReminderEmails = 'sendPlanPriceChangeReminderEmails',

    // Repo
    createRepo = 'createRepo',
    listRepos = 'listRepos',
    getRepo = 'getRepo',
    patchRepo = 'patchRepo',
    deleteRepo = 'deleteRepo',

    // Product
    listProductSummaries = 'listProductSummaries',
    patchProduct = 'patchProduct',
    updateProduct = 'updateProduct',
    createProduct = 'createProduct',
    listProducts = 'listProducts',
    getProduct = 'getProduct',
    getProductBySlug = 'getProductBySlug',
    updateProductAndBrief = 'updateProductAndBrief',
    deleteProduct = 'deleteProduct',
    exportProduct = 'exportProduct',
    importProduct = 'importProduct',
    copyProductAsTemplate = 'copyProductAsTemplate',
    copyTemplateAsProduct = 'copyTemplateAsProduct',
    linkProductToRepo = 'linkProductToRepo',

    // Product Transfer
    requestProductTransfer = 'requestProductTransfer',
    acceptProductTransfer = 'acceptProductTransfer',
    declineProductTransfer = 'declineProductTransfer',
    cancelProductTransfer = 'cancelProductTransfer',
    listPendingProductTransfers = 'listPendingProductTransfers',
    getProductTransferStatus = 'getProductTransferStatus',

    // Repo Transfer
    requestRepoTransfer = 'requestRepoTransfer',
    acceptRepoTransfer = 'acceptRepoTransfer',
    declineRepoTransfer = 'declineRepoTransfer',
    cancelRepoTransfer = 'cancelRepoTransfer',
    listPendingRepoTransfers = 'listPendingRepoTransfers',
    getRepoTransferPreview = 'getRepoTransferPreview',
    getRepoTransferStatus = 'getRepoTransferStatus',

    // Team
    listTeamsForUser = 'listTeamsForUser',
    getTeam = 'getTeam',
    createTeam = 'createTeam',
    updateTeam = 'updateTeam',
    deleteTeam = 'deleteTeam',
    listTeamMembers = 'listTeamMembers',
    inviteTeamMember = 'inviteTeamMember',
    acceptTeamInvite = 'acceptTeamInvite',
    declineTeamInvite = 'declineTeamInvite',
    removeTeamMember = 'removeTeamMember',
    transferTeamOwnership = 'transferTeamOwnership',
    updateMemberRole = 'updateMemberRole',
    listTeamInvites = 'listTeamInvites',
    listPendingInvitesForUser = 'listPendingInvitesForUser',
    resendTeamInvite = 'resendTeamInvite',
    startCreatorPayoutOnboarding = 'startCreatorPayoutOnboarding',
    getCreatorPayoutStatus = 'getCreatorPayoutStatus',

    // UserStory
    patchUserStory = 'patchUserStory',
    listAllUserStories = 'listAllUserStories',
    getUserStory = 'getUserStory',
    createUserStory = 'createUserStory',
    updateUserStory = 'updateUserStory',
    deleteUserStory = 'deleteUserStory',
    listUserStories = 'listUserStories',
    reorderUserStories = 'reorderUserStories',
    renumberUserStories = 'renumberUserStories',

    // Invoice
    listInvoicesAdmin = 'listInvoicesAdmin',
    listInvoices = 'listInvoices',
    getInvoice = 'getInvoice',
    fetchInvoicePdf = 'fetchInvoicePdf',
    syncInvoices = 'syncInvoices',
    syncAllInvoices = 'syncAllInvoices',
    listBillingHistory = 'listBillingHistory',
    listBillingHistoryAdmin = 'listBillingHistoryAdmin',

    // Refund
    fetchCreditNotePdf = 'fetchCreditNotePdf',

    // Subscription
    enableTeamBilling = 'enableTeamBilling',
    getTeamBillingStatus = 'getTeamBillingStatus',
    updateTeamSeatCount = 'updateTeamSeatCount',
    previewTeamBilling = 'previewTeamBilling',
    disableTeamBilling = 'disableTeamBilling',
    updateTeamPaymentMethod = 'updateTeamPaymentMethod',
    applySubscriberDiscount = 'applySubscriberDiscount',
    removeSubscriberDiscount = 'removeSubscriberDiscount',
    zeroRateSubscription = 'zeroRateSubscription',
    removeZeroRating = 'removeZeroRating',
    processExpiredZeroRatings = 'processExpiredZeroRatings',
    adminCreateCharge = 'adminCreateCharge',
    adminCreateRefund = 'adminCreateRefund',
    deleteAllSubscriptions = 'deleteAllSubscriptions',
    syncSubscriptionOut = 'syncSubscriptionOut',
    syncSubscriptionIn = 'syncSubscriptionIn',
    generateSubscriptionReport = 'generateSubscriptionReport',
    listSubscriptions = 'listSubscriptions',
    reactivateSubscription = 'reactivateSubscription',
    createSetupIntent = 'createSetupIntent',
    updateSubscriptionPaymentMethod = 'updateSubscriptionPaymentMethod',
    changeSubscriptionPlan = 'changeSubscriptionPlan',
    cancelSubscription = 'cancelSubscription',
    cancelSubscriptionDowngrade = 'cancelSubscriptionDowngrade',
    finalizeSubscription = 'finalizeSubscription',
    createSubscriptionWithNewCard = 'createSubscriptionWithNewCard',
    createSubscriptionWithStoredCard = 'createSubscriptionWithStoredCard',
    getCurrentSubscription = 'getCurrentSubscription',
    reactivateSubscriptionWithPlanChange = 'reactivateSubscriptionWithPlanChange',

    // Tasks
    listTasks = 'listTasks',
    getTask = 'getTask',
    runTask = 'runTask',
    deleteTask = 'deleteTask',
    rerunTask = 'rerunTask',
    pauseTask = 'pauseTask',
    resumeTask = 'resumeTask',
    cancelTask = 'cancelTask',
    getTaskLog = 'getTaskLog',
    listScheduledTasks = 'listScheduledTasks',
    getScheduledTask = 'getScheduledTask',
    createScheduledTask = 'createScheduledTask',
    updateScheduledTask = 'updateScheduledTask',
    deleteScheduledTask = 'deleteScheduledTask',

    // Revision & Versioning
    listRevisions = 'listRevisions',
    listProductRevisions = 'listProductRevisions',
    getLatestRevision = 'getLatestRevision',
    getRevision = 'getRevision',
    undoRevision = 'undoRevision',
    redoRevision = 'redoRevision',
    bumpMinorVersion = 'bumpMinorVersion',
    bumpMajorVersion = 'bumpMajorVersion',

    // Snapshot
    createProductSnapshot = 'createProductSnapshot',
    listProductSnapshots = 'listProductSnapshots',
    getProductSnapshot = 'getProductSnapshot',
    getSnapshotDiff = 'getSnapshotDiff',

    // Marketplace
    publishListing = 'publishListing',
    getListingForProduct = 'getListingForProduct',
    unpublishListing = 'unpublishListing',
    listPublicListings = 'listPublicListings',
    getPublicListing = 'getPublicListing',
    getPublicSellerProfile = 'getPublicSellerProfile',
    getTeamPublicProfile = 'getTeamPublicProfile',
    updateTeamPublicProfile = 'updateTeamPublicProfile',
    importFreeListing = 'importFreeListing',

    // Test
    test = 'test',

    // Use Case
    listUseCases = 'listUseCases',
    listUseCaseExecutions = 'listUseCaseExecutions',
    purgeUseCaseExecutions = 'purgeUseCaseExecutions',

    // User
    verifyPasswordReset = 'verifyPasswordReset',
    getUserProfile = 'getUserProfile',
    updateUserPrivacy = 'updateUserPrivacy',
    getUserPrivacy = 'getUserPrivacy',
    updateUserNotification = 'updateUserNotification',
    getUserNotification = 'getUserNotification',
    updateUserProfile = 'updateUserProfile',
    saveOnboardingState = 'saveOnboardingState',
    getOnboardingState = 'getOnboardingState',
    completeOnboarding = 'completeOnboarding',
    getOnboardingAnalytics = 'getOnboardingAnalytics',
    updateUserSurvey = 'updateUserSurvey',
    getUserSurvey = 'getUserSurvey',
    signUp = 'signUp',
    logIn = 'logIn',
    logOut = 'logOut',
    forgotPassword = 'forgotPassword',
    resetPassword = 'resetPassword',
    changePassword = 'changePassword',
    startChangeEmail = 'startChangeEmail',
    finishChangeEmail = 'finishChangeEmail',
    listApiKeys = 'listApiKeys',
    createApiKey = 'createApiKey',
    deleteApiKey = 'deleteApiKey',
    pingApiKey = 'pingApiKey',
    createSyntheticUsers = 'createSyntheticUsers',
    deleteAllSyntheticUsers = 'deleteAllSyntheticUsers',

    // Search
    // search = 'search',

    // StoryTestStatus
    syncStoryTestStatus = 'syncStoryTestStatus',
    getStoryTestStatusForProduct = 'getStoryTestStatusForProduct',

    // Verification
    listVerifications = 'listVerifications',
    sendVerificationSms = 'sendVerificationSms',
    sendVerificationEmail = 'sendVerificationEmail',
    verifyEmail = 'verifyEmail',
    verifyEmailWithCode = 'verifyEmailWithCode',
    verifySmsCode = 'verifySmsCode',

}

export const CaseNameSchema = z.nativeEnum(CaseName).describe('Name of a use case');
