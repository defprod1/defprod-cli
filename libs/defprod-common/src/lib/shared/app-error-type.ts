export enum AppErrorType {

    // System
    unknown = 'unknown',
    invalidDeletion = 'invalidDeletion',
    uncaughtError = 'uncaughtError',
    caseNameNotSpecified = 'caseNameNotSpecified',
    unknownUseCaseName = 'unknownCaseName',
    useCaseNotFound = 'useCaseNotFound',
    cannotRunUseCaseAsTask = 'cannotRunUseCaseAsTask',
    cannotRunUseCaseDirectly = 'cannotRunUseCaseDirectly',
    taskNotFound = 'taskNotFound',
    cannotDeleteRunningTask = 'cannotDeleteRunningTask',
    apiKeyNotFound = 'apiKeyNotFound',
    apiKeyIncorrect = 'apiKeyIncorrect',
    apiKeyRevoked = 'apiKeyRevoked',
    apiKeyExpired = 'apiKeyExpired',
    /** A key authenticates, but its owning user has since been deleted (orphaned by a partial cascade or a race). */
    apiKeyOwnerMissing = 'apiKeyOwnerMissing',
    apiKeyAlreadyRotated = 'apiKeyAlreadyRotated',
    apiKeyPermissionDenied = 'apiKeyPermissionDenied',
    apiKeyScopeDenied = 'apiKeyScopeDenied',
    invalidRequest = 'invalidRequest',
    unauthenticatedRequest = 'unauthenticatedRequest',
    requestTooLarge = 'requestTooLarge',
    crossSiteRequestRefused = 'crossSiteRequestRefused',

    // User
    userNotFound = 'userNotFound',
    userAlreadyExists = 'userAlreadyExists',
    userNotLoggedIn = 'userNotLoggedIn',
    userNotVerified = 'userNotVerified',
    userNotAuthorized = 'userNotAuthorized',
    accountDisabled = 'accountDisabled',
    impersonationTargetDisabled = 'impersonationTargetDisabled',
    impersonationExpired = 'impersonationExpired',
    /** Stopping an impersonation found its admin demoted or disabled: the session was signed out (ADMIN-52 AC9). */
    impersonationAdminRevoked = 'impersonationAdminRevoked',
    impersonationForbidden = 'impersonationForbidden',
    wrongUsernameOrPassword = 'wrongUsernameOrPassword',
    invalidEmailAddress = 'invalidEmailAddress',
    invalidCategory = 'invalidCategory',
    invalidCode = 'invalidCode',
    invalidMessage = 'invalidMessage',
    invalidName = 'invalidName',
    invalidPassword = 'invalidPassword',
    invalidPhoneNumber = 'invalidPhoneNumber',
    duplicatePhoneNumber = 'duplicatePhoneNumber',
    invalidSpeed = 'invalidSpeed',
    invalidRating = 'invalidRating',
    invalidUser = 'invalidUser',
    invalidValue = 'invalidValue',

    // Agent
    agentNotFound = 'agentNotFound',
    agentNotAuthorized = 'agentNotAuthorized',

    // Email
    emailSendFailed = 'emailSendFailed',

    // Architecture
    architectureNotFound = 'architectureNotFound',
    architectureElementNotFound = 'architectureElementNotFound',
    architectureElementInvalidParent = 'architectureElementInvalidParent',
    architectureElementTreeMultipleRoots = 'architectureElementTreeMultipleRoots',

    // Area
    areaNotFound = 'areaNotFound',

    // Brief
    briefNotFound = 'briefNotFound',

    // GenAi
    genAiSessionNotFound = 'genAiSessionNotFound',
    genAiContextEmpty = 'genAiContextEmpty',
    genAiContextTooLarge = 'genAiContextTooLarge',
    genAiProviderError = 'genAiProviderError',

    // LLM
    llmClientNotInitialized = 'llmClientNotInitialized',
    llmAnalysisFailed = 'llmAnalysisFailed',
    llmRateLimitExceeded = 'llmRateLimitExceeded',

    // Payment
    invalidPaymentMethod = 'invalidPaymentMethod',
    paymentMethodNotFound = 'paymentMethodNotFound',
    cardDeclined = 'cardDeclined',
    cardExpired = 'cardExpired',
    stripeError = 'stripeError',

    // Product
    productNotFound = 'productNotFound',
    productSlugConflict = 'productSlugConflict',

    // Repo
    repoNotFound = 'repoNotFound',

    // Snapshot
    versionAlreadyPublished = 'versionAlreadyPublished',

    // Marketplace
    marketplaceListingNotFound = 'marketplaceListingNotFound',
    marketplaceListingAlreadyPublished = 'marketplaceListingAlreadyPublished',
    marketplacePayoutSetupRequired = 'marketplacePayoutSetupRequired',
    marketplaceListingNotFree = 'marketplaceListingNotFree',
    marketplaceCannotImportOwnListing = 'marketplaceCannotImportOwnListing',

    // Team
    teamNotFound = 'teamNotFound',
    teamInviteNotFound = 'teamInviteNotFound',
    teamNotAuthorized = 'teamNotAuthorized',
    /** A write would change who owns a record (ADR0024 D7). Only a team transfer may do that. */
    ownershipImmutable = 'ownershipImmutable',

    // Subscription
    subscriptionNotFound = 'subscriptionNotFound',
    subscriptionAlreadyExists = 'subscriptionAlreadyExists',
    subscriptionNotActive = 'subscriptionNotActive',
    subscriptionAlreadyCancelled = 'subscriptionAlreadyCancelled',
    invalidPlanChange = 'invalidPlanChange',
    invalidPlanPrice = 'invalidPlanPrice',

    // User Story
    userStoryNotFound = 'userStoryNotFound',
    planNotFound = 'planNotFound',
    planHasSubscriptions = 'planHasSubscriptions',

    // Change
    changeNotFound = 'changeNotFound',
    duplicateChangeOrigin = 'duplicateChangeOrigin',

    // Change group (docs/areas/changes/change-groups-design.md)
    changeGroupNotFound = 'changeGroupNotFound',
    /** A closed group accepts no new members (D3, D10); removal and moves out stay allowed. */
    changeGroupClosed = 'changeGroupClosed',
    /** The change is already in another group and the caller did not pass `move: true` (D7). */
    changeGroupMoveRequired = 'changeGroupMoveRequired',
    /** The group belongs to a different team from the change's product (D2). */
    changeGroupTeamMismatch = 'changeGroupTeamMismatch',
    /** Deleting the group would ungroup changes outside the caller's reach (D6). */
    changeGroupMembersOutOfReach = 'changeGroupMembersOutOfReach',
    /** The change's membership moved under a concurrent write; re-read and retry. */
    changeGroupMembershipConflict = 'changeGroupMembershipConflict',

    // CdRun
    cdRunNotFound = 'cdRunNotFound',

    // Release
    releaseNotFound = 'releaseNotFound',

    // Invoice
    invoiceNotFound = 'invoiceNotFound',

    // Refund
    refundExceedsInvoiceAmount = 'refundExceedsInvoiceAmount',
    refundNotFound = 'refundNotFound',

    // Features
    featureNotAvailable = 'featureNotAvailable',
    featureLimitExceeded = 'featureLimitExceeded',
    featureRateLimitExceeded = 'featureRateLimitExceeded',

    /*
     * Deliberately distinct from `featureLimitExceeded`, which means "you cannot create another
     * one" and is already rendered that way. The two states need different offers: that one is
     * upgrade-or-delete, this one is upgrade-or-choose-this-definition-instead. It is also not
     * `teamNotAuthorized` — this is a plan boundary, not a security denial, and telling a
     * paying-customer-in-waiting they are "not authorized" for their own definition is both
     * wrong and the worst available moment to say it (defprod/CHG-178, D7).
     */
    productReadOnlyOverQuota = 'productReadOnlyOverQuota',

    // Availability (survival rate-limit backstop — distinct from the commercial featureRateLimitExceeded)
    requestRateLimited = 'requestRateLimited',
    // Sign-in throttle (USER-37): too many failed attempts for an account or from an address. Unlike
    // requestRateLimited this is meant for the person, so the client shows it.
    tooManyAttempts = 'tooManyAttempts',

    // General
    notFound = 'notFound',
    notAuthorized = 'notAuthorized',
    notImplemented = 'notImplemented',
    internalError = 'internalError',
}
