package gofakeit

// VehicleInfo is a struct dataset of all vehicle information
type VehicleInfo struct {
	// Vehicle type
	VehicleType string
	// Fuel type
	Fuel string
	// Transmission type
	TransmissionGear string
	// Brand name
	Brand string
	// Vehicle model
	Model string
	// Vehicle model year
	Year int
}

// Vehicle will generate a struct with vehicle information
func Vehicle() *VehicleInfo {
	return &VehicleInfo{
		VehicleType:      VehicleType(),
		Fuel:             FuelType(),
		TransmissionGear: TransmissionGearType(),
		Brand:            CarMaker(),
		Model:            CarModel(),
		Year:             Year(),
	}

}

// VehicleType will generate a random vehicle type string
func VehicleType() string {
	return getRandValue([]string{"vehicle", "vehicle_type"})
}

// FuelType will return a random fuel type
func FuelType() string {
	return getRandValue([]string{"vehicle", "fuel_type"})
}

// TransmissionGearType will return a random transmission gear type
func TransmissionGearType() string {
	return getRandValue([]string{"vehicle", "transmission_type"})
}

// CarMaker will return a random car maker
func CarMaker() string {
	return getRandValue([]string{"vehicle", "maker"})
}

// CarModel will return a random car model
func CarModel() string {
	return getRandValue([]string{"vehicle", "model"})
}
