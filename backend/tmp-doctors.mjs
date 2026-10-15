import mongoose from 'mongoose';
await mongoose.connect('mongodb://127.0.0.1:27017/medicare');
const db = mongoose.connection.db;
const orgs = await db.collection('organizations').find({}, { projection: { name: 1, slug: 1 } }).toArray();
const people = await db.collection('personnels').find({}, { projection: { firstName: 1, lastName: 1, role: 1, organizationId: 1, status: 1, userId: 1 } }).toArray();
const users = await db.collection('users').find({}, { projection: { firstName: 1, lastName: 1, role: 1, organizationId: 1, email: 1 } }).toArray();
const orgName = (id) => orgs.find((org) => String(org._id) === String(id))?.name || String(id);
console.log(JSON.stringify({
  orgs: orgs.map((org) => ({ name: org.name, slug: org.slug })),
  people: people.map((row) => ({
    name: `${row.firstName} ${row.lastName}`,
    role: row.role,
    status: row.status,
    org: orgName(row.organizationId),
    userId: row.userId ? String(row.userId) : null,
  })),
  users: users.map((row) => ({
    id: String(row._id),
    name: `${row.firstName} ${row.lastName}`,
    role: row.role,
    org: row.organizationId ? orgName(row.organizationId) : null,
  })),
}, null, 2));
await mongoose.disconnect();
