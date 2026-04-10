namespace WebApplication1.Data;

public record UpsertSupporterDto(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string? DisplayName,
    string? SupporterType = null,
    string? AcquisitionChannel = null
);

public record CreateDonationDto(
    int SupporterId,
    decimal Amount,
    string CurrencyCode,
    bool IsRecurring,
    string? DonationType,
    string? ChannelSource,
    string? CampaignName,
    string? Notes
);

public record CreateResidentDto(
    int Age,
    int SafehouseId,
    string AssignedSocialWorker,
    string? SwEmail,
    string RiskLevel
);

public record UpdateSupporterDto(
    string? FirstName,
    string? LastName,
    string? DisplayName,
    string? Email,
    string? Phone
);
