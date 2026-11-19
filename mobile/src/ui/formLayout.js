const LAYOUT = {
  vehicles: {
    order: ['reg', 'make', 'model', 'year', 'rate', 'owner', 'ownership', 'ownerCost', 'billMode', 'billHours', 'hourRate', 'status'],
    pairs: [['make', 'model'], ['year', 'rate'], ['billHours', 'hourRate']]
  },
  drivers: {
    order: ['name', 'phone', 'license', 'vehicleId', 'allowance', 'kind', 'status'],
    pairs: [['name', 'phone'], ['license', 'vehicleId'], ['allowance', 'kind']]
  },
  clients: {
    order: ['name', 'phone', 'type', 'idnum', 'area', 'dl', 'driverName', 'driverPhone'],
    pairs: [['phone', 'type'], ['idnum', 'area'], ['driverName', 'driverPhone']]
  },
  bookings: {
    order: ['vehicleId', 'clientId', 'pickup', 'return', 'deposit', 'bookedOn', 'status'],
    pairs: [['pickup', 'return'], ['deposit', 'bookedOn']]
  },
  rentals: {
    order: ['vehicleId', 'clientId', 'newClientName', 'contract', 'pickup', 'pickupTime', 'return', 'returnTime', 'rate', 'billMode', 'days', 'amount', 'fuel', 'fuelCharge', 'allowance', 'driverId', 'status', 'subhireCost', 'subhirePaid', 'mileage', 'invoice', 'receipt'],
    pairs: [['vehicleId', 'clientId'], ['newClientName', 'contract'], ['pickup', 'pickupTime'], ['return', 'returnTime'], ['rate', 'billMode'], ['fuel', 'fuelCharge'], ['allowance', 'driverId'], ['subhireCost', 'subhirePaid']]
  },
  payments: {
    order: ['rentalId', 'amount', 'date', 'method', 'note'],
    pairs: [['amount', 'date'], ['method', 'note']]
  },
  expenses: {
    order: ['category', 'vehicleId', 'date', 'amount', 'desc', 'qty', 'account', 'rentalId', 'billable', 'billClientId', 'chargeAmount'],
    pairs: [['category', 'vehicleId'], ['date', 'amount'], ['billClientId', 'chargeAmount']]
  },
  fuelTopup: {
    order: ['amount', 'date', 'note'],
    pairs: [['amount', 'date']]
  },
  coops: {
    order: ['name', 'department', 'start', 'end', 'days', 'contract', 'amount', 'kmOut', 'kmIn'],
    pairs: [['name', 'department'], ['start', 'end'], ['days', 'contract'], ['kmOut', 'kmIn']]
  }
};

export function layoutFields(form, fields) {
  const layout = LAYOUT[form];
  if (!layout) return fields.map(field => [field]);

  const order = new Map(layout.order.map((key, index) => [key, index]));
  const arranged = fields.map((field, index) => ({ field, index })).sort((a, b) => {
    const rankA = order.has(a.field.key) ? order.get(a.field.key) : Number.MAX_SAFE_INTEGER;
    const rankB = order.has(b.field.key) ? order.get(b.field.key) : Number.MAX_SAFE_INTEGER;
    return rankA === rankB ? a.index - b.index : rankA - rankB;
  }).map(item => item.field);
  const pairs = new Map(layout.pairs.map(([first, second]) => [first, second]));
  const rows = [];

  for (let index = 0; index < arranged.length; index++) {
    const field = arranged[index], pairedKey = pairs.get(field.key);
    if (pairedKey && arranged[index + 1] && arranged[index + 1].key === pairedKey) {
      rows.push([field, arranged[++index]]);
    } else rows.push([field]);
  }
  return rows;
}
