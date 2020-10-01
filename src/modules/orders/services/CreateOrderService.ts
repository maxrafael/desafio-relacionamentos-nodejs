import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer not found');
    }

    const existsProducts = await this.productsRepository.findAllById(products);

    if (!existsProducts.length) {
      throw new AppError('Products not found');
    }

    const existsProductsIds = existsProducts.map(product => product.id);

    const productNotExists = products.filter(
      product => !existsProductsIds.includes(product.id),
    );

    if (productNotExists.length) {
      throw new AppError(`Could not find product ${productNotExists[0].id}`);
    }

    const findProductNoQuantity = products.filter(
      product =>
        existsProducts.filter(p => p.id === product.id)[0].quantity <=
        product.quantity,
    );

    if (findProductNoQuantity.length) {
      throw new AppError(
        `The quantity ${findProductNoQuantity[0].quantity} is not available for ${findProductNoQuantity[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existsProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const updateQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existsProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(updateQuantity);

    return order;
  }
}

export default CreateOrderService;
