# Security Specification - Ayam Geprek ARY POS & Stock

## 1. Data Invariants
1. `ingredients`: Stock must be non-negative numbers. Stock can only be mutated through valid transactions, production entries, stock opname adjustments, or purchases.
2. `products`: Every sale item must reference a valid product and calculate ingredient deduction according to its active `Recipe`.
3. `recipes`: Standard BOM items mapping products to raw/prepared ingredients.
4. `sales`: Transactions must have unique transaction numbers, valid total calculation, and status of `COMPLETED` or `VOID`. `VOID` transactions must trigger stock reversal movements.
5. `users`: Role-based access control (`ADMIN`, `KASIR`, `OWNER`). Kasir can create sales and read menu/ingredients, but cannot modify recipes, prices, or delete sales.

## 2. Dirty Dozen Validation Payloads
- Payload 1: Attempt to create sale without cashier UID matching current user.
- Payload 2: Attempt to set negative stock on ingredient.
- Payload 3: Attempt by Kasir role to modify product selling price.
- Payload 4: Attempt to delete sale record directly (must use VOID status transition instead).
- Payload 5: Attempt to modify recipe without ADMIN or OWNER role.
- Payload 6: Attempt to inject invalid status into transaction (e.g. `HACKED`).
- Payload 7: Attempt to create stock movement without valid type.
- Payload 8: Attempt to set employee wage to negative.
- Payload 9: Attempt to modify historical stock movement entry.
- Payload 10: Attempt to assign self ADMIN role during profile creation.
- Payload 11: Attempt to bypass transaction number formatting.
- Payload 12: Attempt to corrupt production yield entry.

## 3. Rules Strategy
- `isSignedIn()` check for all authenticated operations.
- `isAdminOrOwner()` for write/update on recipes, products, employees, expenses, purchases.
- `isKasir()` or `isSignedIn()` allowed to create sales, view ingredients, view products.
