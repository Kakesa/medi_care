import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGODB_URI);
const users = await mongoose.connection.collection('users').find({ role: 'RECEPTIONIST' }).project({
  email: 1,
  firstName: 1,
  lastName: 1,
  organizationId: 1,
  isActive: 1,
}).toArray();
const orgs = await mongoose.connection.collection('organizations').find({
  _id: { $in: users.map((user) => user.organizationId).filter(Boolean) },
}).project({ name: 1 }).toArray();
const names = new Map(orgs.map((org) => [String(org._id), org.name]));
console.log(JSON.stringify(users.map((user) => ({
  email: user.email,
  name: `${user.firstName} ${user.lastName}`,
  hospital: names.get(String(user.organizationId)) || '',
  active: user.isActive !== false,
})), null, 2));
await mongoose.disconnect();
