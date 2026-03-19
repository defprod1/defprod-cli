import { z } from 'zod';

export enum CaseName {

    // Address
    getAddressLookup = 'getAddressLookup',

    // Admin
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
    listUsers = 'listUsers',
    migrateProductsToTeams = 'migrateProductsToTeams',

    // Agent
    listAgents = 'listAgents',
    getAgent = 'getAgent',
    createAgent = 'createAgent',
    updateAgent = 'updateAgent',
    deleteAgent = 'deleteAgent',
    startDefinitionGenAiSession = 'startDefinitionGenAiSession',
    continueDefinitionGenAiSession = 'continueDefinitionGenAiSession',
    deleteDefinitionGenAiSession = 'deleteDefinitionGenAiSession',

    // Analytics
    logPaymentError = 'logPaymentError',
    listPaymentErrorAnalytics = 'listPaymentErrorAnalytics',

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

    // Feedback
    submitAppFeedback = 'submitAppFeedback',
    submitWebFeedback = 'submitWebFeedback',

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

    // Product
    listProductSummaries = 'listProductSummaries',
    patchProduct = 'patchProduct',
    updateProduct = 'updateProduct',
    createProduct = 'createProduct',
    listProducts = 'listProducts',
    getProduct = 'getProduct',
    updateProductAndBrief = 'updateProductAndBrief',
    deleteProduct = 'deleteProduct',
    exportProduct = 'exportProduct',
    importProduct = 'importProduct',
    copyProductAsTemplate = 'copyProductAsTemplate',
    copyTemplateAsProduct = 'copyTemplateAsProduct',

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
    listInvoices = 'listInvoices',
    getInvoice = 'getInvoice',
    syncInvoices = 'syncInvoices',

    // Subscription
    enableTeamBilling = 'enableTeamBilling',
    getTeamBillingStatus = 'getTeamBillingStatus',
    updateTeamSeatCount = 'updateTeamSeatCount',
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

    // Test
    test = 'test',

    // Use Case
    listUseCases = 'listUseCases',
    listUseCaseExecutions = 'listUseCaseExecutions',

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
    createSyntheticUsers = 'createSyntheticUsers',
    deleteAllSyntheticUsers = 'deleteAllSyntheticUsers',

    // Search
    // search = 'search',

    // Verification
    listVerifications = 'listVerifications',
    sendVerificationSms = 'sendVerificationSms',
    sendVerificationEmail = 'sendVerificationEmail',
    verifyEmail = 'verifyEmail',
    verifyEmailWithCode = 'verifyEmailWithCode',
    verifySmsCode = 'verifySmsCode',

}

export const CaseNameSchema = z.nativeEnum(CaseName).describe('Name of a use case');
